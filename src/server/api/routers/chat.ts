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
            const FREE_MODELS = ["gpt-3.5-turbo", "gemini-1.5-flash"];

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

            if (!chatId) {
                const newChat = await ctx.db.chat.create({
                    data: {
                        title: input.content.slice(0, 30) || "New Chat",
                        userId: ctx.auth.userId,
                    },
                });
                chatId = newChat.id;
            }

            const chat = await ctx.db.chat.findUnique({
                where: { id: chatId },
            });

            if (!chat) {
                throw new TRPCError({ code: "NOT_FOUND" });
            }

            if (chat.userId && chat.userId !== ctx.auth.userId) {
                throw new TRPCError({ code: "UNAUTHORIZED" });
            }

            // Save user message
            const userMessage = await ctx.db.message.create({
                data: {
                    chatId: chatId,
                    content: input.content,
                    role: "user",
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
                },
            });

            return { userMessage, aiMessage, newChatId: !input.chatId ? chatId : undefined };
        }),
});
