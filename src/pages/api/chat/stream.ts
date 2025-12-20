import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "~/env";
import { db } from "~/server/db";
import { TRPCError } from "@trpc/server";

export const config = {
  runtime: "nodejs",
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = getAuth(req);
  const { chatId, content, model, language } = req.body as {
    chatId?: string;
    content: string;
    model: string;
    language?: string;
  };

  if (!content || !model) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const FREE_MODELS = ["gpt-3.5-turbo"];

    if (!auth.userId && !FREE_MODELS.includes(model)) {
      return res.status(403).json({
        error: "You must be signed in to use this model.",
      });
    }

    let finalChatId = chatId;
    let chat;

    // Create or validate chat
    if (!finalChatId) {
      chat = await db.chat.create({
        data: {
          title: content.slice(0, 30) || "New Chat",
          userId: auth.userId,
        },
      });
      finalChatId = chat.id;
    } else {
      chat = await db.chat.findUnique({
        where: { id: finalChatId },
      });

      if (!chat) {
        return res.status(404).json({ error: "Chat not found" });
      }

      if (chat.userId && chat.userId !== auth.userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }
    }

    // Set up SSE headers FIRST for immediate response
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    // Send immediate acknowledgment to establish stream
    res.write(`data: ${JSON.stringify({ connected: true })}\n\n`);
    if (res.flush) res.flush();

    // Save user message asynchronously (don't wait)
    const userMessagePromise = db.message.create({
      data: {
        chatId: finalChatId,
        content: content,
        role: "user",
        model: model,
        language: language,
      },
    });

    // Format language instruction
    let languageName = language
      ? language.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : "";

    if (language === "malay-arabic") {
      languageName = "Malay (Jawi script)";
    }

    const languageInstruction =
      language && language !== "english"
        ? `Please respond in ${languageName}. `
        : "";

    let fullAiContent = "";

    try {
      // Stream based on model
      if (model.startsWith("claude")) {
        if (!env.ANTHROPIC_API_KEY)
          throw new Error("Anthropic API Key not found");
        const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

        const stream = await anthropic.messages.stream({
          model: model,
          max_tokens: 1000,
          system: languageInstruction,
          messages: [
            {
              role: "user",
              content: content,
            },
          ],
        });

        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            const text = chunk.delta.text;
            fullAiContent += text;
            res.write(`data: ${JSON.stringify({ token: text })}\n\n`);
            // Force flush to send immediately
            if (res.flush) res.flush();
          }
        }
      } else if (model.startsWith("gpt") || model === "chatgpt-5.1") {
        if (!env.OPENAI_API_KEY) throw new Error("OpenAI API Key not found");
        const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          {
            role: "user",
            content: content,
          },
        ];

        if (languageInstruction) {
          messages.unshift({
            role: "system",
            content: languageInstruction,
          });
        }

        const apiModel = model === "chatgpt-5.1" ? "gpt-4o" : model;

        const stream = await openai.chat.completions.create({
          model: apiModel,
          messages: messages,
          stream: true,
        });

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) {
            fullAiContent += text;
            res.write(`data: ${JSON.stringify({ token: text })}\n\n`);
            // Force flush to send immediately
            if (res.flush) res.flush();
          }
        }
      } else if (model.startsWith("gemini")) {
        if (!env.GOOGLE_API_KEY) throw new Error("Google API Key not found");
        const genAI = new GoogleGenerativeAI(env.GOOGLE_API_KEY);
        const geminiModel = genAI.getGenerativeModel({ model: model });

        const prompt = languageInstruction
          ? `${languageInstruction}\n\n${content}`
          : content;

        const result = await geminiModel.generateContentStream(prompt);

        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            fullAiContent += text;
            res.write(`data: ${JSON.stringify({ token: text })}\n\n`);
            // Force flush to send immediately
            if (res.flush) res.flush();
          }
        }
      } else {
        throw new Error(`Unsupported model: ${model}`);
      }

      // Ensure user message is saved and save AI response
      const userMessage = await userMessagePromise;
      const aiMessage = await db.message.create({
        data: {
          chatId: finalChatId,
          content: fullAiContent,
          role: "assistant",
          model: model,
          language: language,
        },
      });

      // Send completion event
      res.write(
        `data: ${JSON.stringify({
          done: true,
          userMessageId: userMessage.id,
          aiMessageId: aiMessage.id,
          newChatId: !chatId ? finalChatId : undefined,
        })}\n\n`
      );
      if (res.flush) res.flush();
    } catch (error) {
      console.error("AI API Error:", error);
      const errorMessage = `Error calling AI model (${model}): ${(error as Error).message}`;
      fullAiContent = errorMessage;

      // Save error message
      await db.message.create({
        data: {
          chatId: finalChatId,
          content: errorMessage,
          role: "assistant",
          model: model,
          language: language,
        },
      });

      res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
    }

    res.end();
  } catch (error) {
    console.error("Stream handler error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: (error as Error).message });
    } else {
      res.write(
        `data: ${JSON.stringify({ error: (error as Error).message })}\n\n`
      );
      res.end();
    }
  }
}
