import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "~/env";
import { TRPCError } from "@trpc/server";

export const chatRouter = createTRPCRouter({
    create: publicProcedure.mutation(async ({ ctx }) => {
        // Allow guest to create chat (userId will be null)
        return ctx.db.chat.create({
            data: {
                title: "New Chat",
                userId: ctx.auth.userId ?? null,
            },
        });
    }),

    updateTitle: publicProcedure
        .input(z.object({
            chatId: z.string(),
            title: z.string().min(1).max(100),
        }))
        .mutation(async ({ ctx, input }) => {
            const chat = await ctx.db.chat.findUnique({
                where: { id: input.chatId },
            });

            if (!chat) {
                throw new TRPCError({ code: "NOT_FOUND" });
            }

            // If chat has a user, ensure it matches the session user
            if (chat.userId && chat.userId !== ctx.auth.userId) {
                throw new TRPCError({ code: "UNAUTHORIZED" });
            }

            return ctx.db.chat.update({
                where: { id: input.chatId },
                data: { title: input.title },
            });
        }),

    generateTitle: publicProcedure
        .input(z.object({
            chatId: z.string(),
            model: z.string(),
        }))
        .mutation(async ({ ctx, input }) => {
            // Verify chat ownership
            const chat = await ctx.db.chat.findUnique({
                where: { id: input.chatId },
            });

            if (!chat) {
                throw new TRPCError({ code: "NOT_FOUND" });
            }

            if (chat.userId && chat.userId !== ctx.auth.userId) {
                throw new TRPCError({ code: "UNAUTHORIZED" });
            }

            // Fetch first 4 messages for context
            const messages = await ctx.db.message.findMany({
                where: { chatId: input.chatId },
                orderBy: { createdAt: "asc" },
                take: 4,
            });

            if (messages.length === 0) {
                throw new TRPCError({ code: "BAD_REQUEST", message: "No messages found" });
            }

            // Build conversation context
            const conversationContext = messages
                .map((m) => `${m.role}: ${m.content}`)
                .join("\n");

            const titlePrompt = `Based on this conversation, generate a concise 3-5 word title that summarizes the topic. Only return the title, nothing else.\n\n${conversationContext}`;

            let generatedTitle = "";

            try {
                if (input.model.startsWith("claude")) {
                    if (!env.ANTHROPIC_API_KEY) throw new Error("Anthropic API Key not found");
                    const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
                    const message = await anthropic.messages.create({
                        model: input.model,
                        max_tokens: 50,
                        messages: [{ role: "user", content: titlePrompt }],
                    });
                    generatedTitle = message.content[0]?.type === "text"
                        ? message.content[0].text.trim()
                        : "New Chat";
                } else if (input.model.startsWith("gpt") || input.model === "chatgpt-5.1") {
                    if (!env.OPENAI_API_KEY) throw new Error("OpenAI API Key not found");
                    const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
                    const apiModel = input.model === "chatgpt-5.1" ? "gpt-4o" : input.model;
                    const completion = await openai.chat.completions.create({
                        model: apiModel,
                        messages: [{ role: "user", content: titlePrompt }],
                        max_tokens: 50,
                    });
                    generatedTitle = completion.choices[0]?.message?.content?.trim() ?? "New Chat";
                } else if (input.model.startsWith("gemini")) {
                    if (!env.GOOGLE_API_KEY) throw new Error("Google API Key not found");
                    const genAI = new GoogleGenerativeAI(env.GOOGLE_API_KEY);
                    const geminiModel = genAI.getGenerativeModel({ model: input.model });
                    const result = await geminiModel.generateContent(titlePrompt);
                    generatedTitle = result.response.text().trim();
                } else {
                    throw new Error(`Unsupported model: ${input.model}`);
                }

                // Sanitize and limit title length
                generatedTitle = generatedTitle
                    .replace(/^["']|["']$/g, "") // Remove quotes
                    .slice(0, 100); // Max 100 chars

                if (!generatedTitle || generatedTitle.length === 0) {
                    generatedTitle = "New Chat";
                }
            } catch (error) {
                console.error("Title generation error:", error);
                generatedTitle = messages[0]?.content.slice(0, 30) ?? "New Chat";
            }

            // Update chat title
            const updatedChat = await ctx.db.chat.update({
                where: { id: input.chatId },
                data: { title: generatedTitle },
            });

            return { title: updatedChat.title };
        }),

    getAll: publicProcedure.query(async ({ ctx }) => {
        if (!ctx.auth.userId) {
            return [];
        }
        return ctx.db.chat.findMany({
            where: {
                userId: ctx.auth.userId,
            },
            orderBy: {
                updatedAt: "desc",
            },
        });
    }),

    getChatsByIds: publicProcedure
        .input(z.object({ chatIds: z.array(z.string()) }))
        .query(async ({ ctx, input }) => {
            if (input.chatIds.length === 0) return [];

            return ctx.db.chat.findMany({
                where: {
                    id: { in: input.chatIds },
                    userId: null, // Only return guest chats to prevent accessing user chats
                },
                orderBy: {
                    updatedAt: "desc",
                },
            });
        }),

    getMessages: publicProcedure
        .input(z.object({ chatId: z.string() }))
        .query(async ({ ctx, input }) => {
            const chat = await ctx.db.chat.findUnique({
                where: { id: input.chatId },
            });

            if (!chat) {
                throw new TRPCError({ code: "NOT_FOUND" });
            }

            // If chat has a user, ensure it matches the session user
            if (chat.userId && chat.userId !== ctx.auth.userId) {
                throw new TRPCError({ code: "UNAUTHORIZED" });
            }

            return ctx.db.message.findMany({
                where: {
                    chatId: input.chatId,
                },
                orderBy: {
                    createdAt: "asc",
                },
            });
        }),

    sendMessage: publicProcedure
        .input(
            z.object({
                chatId: z.string().optional(),
                content: z.string(),
                model: z.string().optional(),
                language: z.string().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            try {
                const FREE_MODELS = ["gpt-3.5-turbo"]; // Gemini temporarily disabled - see BUGS.md

                let model = input.model;
                // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                if (!model) {
                    model = ctx.auth.userId ? "chatgpt-5.1" : "gpt-3.5-turbo";
                }

                if (!ctx.auth.userId && !FREE_MODELS.includes(model)) {
                    throw new TRPCError({
                        code: "FORBIDDEN",
                        message: "You must be signed in to use this model.",
                    });
                }

                let chatId = input.chatId;
                let chat;

                if (!chatId) {
                    chat = await ctx.db.chat.create({
                        data: {
                            title: input.content.slice(0, 30) || "New Chat",
                            userId: ctx.auth.userId,
                        },
                    });
                    chatId = chat.id;
                } else {
                    chat = await ctx.db.chat.findUnique({
                        where: { id: chatId },
                    });

                    if (!chat) {
                        throw new TRPCError({ code: "NOT_FOUND" });
                    }

                    if (chat.userId && chat.userId !== ctx.auth.userId) {
                        throw new TRPCError({ code: "UNAUTHORIZED" });
                    }
                }

                // Save user message
                const userMessage = await ctx.db.message.create({
                    data: {
                        chatId: chatId,
                        content: input.content,
                        role: "user",
                        model: model,
                        language: input.language,
                    },
                });

                let aiContent = "";

                // Format language string (replace hyphens with spaces, capitalize)
                let languageName = input.language ? input.language.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "";

                if (input.language === "malay-arabic") {
                    languageName = "Malay (Jawi script)";
                }

                const languageInstruction = input.language && input.language !== "english"
                    ? `Please respond in ${languageName}. `
                    : "";

                try {
                    if (model.startsWith("claude")) {
                        if (!env.ANTHROPIC_API_KEY) throw new Error("Anthropic API Key not found");
                        const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
                        const message = await anthropic.messages.create({
                            model: model,
                            max_tokens: 1000,
                            system: languageInstruction,
                            messages: [
                                {
                                    role: "user",
                                    content: input.content,
                                },
                            ],
                        });

                        if (message.content[0]?.type === "text") {
                            aiContent = message.content[0].text;
                        } else {
                            aiContent = "No text response from Claude";
                        }
                    } else if (model.startsWith("gpt") || model === "chatgpt-5.1") {
                        if (!env.OPENAI_API_KEY) throw new Error("OpenAI API Key not found");
                        const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
                        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
                            {
                                role: "user",
                                content: input.content,
                            },
                        ];

                        if (languageInstruction) {
                            messages.unshift({
                                role: "system",
                                content: languageInstruction,
                            });
                        }

                        const apiModel = model === "chatgpt-5.1" ? "gpt-4o" : model;

                        const completion = await openai.chat.completions.create({
                            model: apiModel,
                            messages: messages,
                        });
                        aiContent = completion.choices[0]?.message?.content ?? "No text response from OpenAI";
                    } else if (model.startsWith("gemini")) {
                        if (!env.GOOGLE_API_KEY) throw new Error("Google API Key not found");
                        const genAI = new GoogleGenerativeAI(env.GOOGLE_API_KEY);
                        const geminiModel = genAI.getGenerativeModel({ model: model });

                        const prompt = languageInstruction
                            ? `${languageInstruction}\n\n${input.content}`
                            : input.content;

                        const result = await geminiModel.generateContent(prompt);
                        const response = result.response;
                        aiContent = response.text();
                    } else {
                        throw new Error(`Unsupported model: ${model}`);
                    }
                } catch (error) {
                    console.error("AI API Error:", error);
                    aiContent = `Error calling AI model (${model}): ${(error as Error).message}`;
                }

                // Save AI response
                const aiMessage = await ctx.db.message.create({
                    data: {
                        chatId: chatId,
                        content: aiContent,
                        role: "assistant",
                        model: model,
                        language: input.language,
                    },
                });

                // Generate title if this is the first AI response
                const messageCount = await ctx.db.message.count({
                    where: { chatId: chatId },
                });

                if (messageCount === 2) {
                    // Run asynchronously to not block the response
                    void (async () => {
                        try {
                            const { createCaller } = await import("~/server/api/root");
                            const caller = createCaller({ auth: ctx.auth, db: ctx.db });
                            await caller.chat.generateTitle({ chatId, model });
                        } catch (error) {
                            console.error("Background title generation failed:", error);
                        }
                    })();
                }

                return { userMessage, aiMessage, newChatId: !input.chatId ? chatId : undefined };
            } catch (error) {
                console.error("sendMessage Mutation Error:", error);
                throw error;
            }
        }),
});
