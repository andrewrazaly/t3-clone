import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "~/env";

export const chatRouter = createTRPCRouter({
    create: publicProcedure.mutation(async ({ ctx }) => {
        return ctx.db.chat.create({
            data: {
                title: "New Chat",
            },
        });
    }),

    getAll: publicProcedure.query(async ({ ctx }) => {
        return ctx.db.chat.findMany({
            orderBy: {
                updatedAt: "desc",
            },
        });
    }),

    getMessages: publicProcedure
        .input(z.object({ chatId: z.string() }))
        .query(async ({ ctx, input }) => {
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
                chatId: z.string(),
                content: z.string(),
                model: z.string().optional(),
                language: z.string().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            // Save user message
            const userMessage = await ctx.db.message.create({
                data: {
                    chatId: input.chatId,
                    content: input.content,
                    role: "user",
                },
            });

            let aiContent = "";

            const model = input.model ?? "gpt-4o";
            const languageInstruction = input.language && input.language !== "english"
                ? `Please respond in ${input.language}. `
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
                } else if (model.startsWith("gpt")) {
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

                    const completion = await openai.chat.completions.create({
                        model: model,
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
                    chatId: input.chatId,
                    content: aiContent,
                    role: "assistant",
                },
            });

            return { userMessage, aiMessage };
        }),
});
