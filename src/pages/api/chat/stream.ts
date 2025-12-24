/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/await-thenable */
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "~/env";
import { db } from "~/server/db";
import { TRPCError } from "@trpc/server";
import fs from "fs";
import path from "path";

// #region agent log helper
const DEBUG_LOG_PATH = path.join(process.cwd(), ".cursor", "debug.log");
let logFileInitialized = false;

function ensureLogClearedOnce() {
  if (logFileInitialized) return;
  try {
    fs.writeFileSync(DEBUG_LOG_PATH, ""); // truncate for a clean run
  } catch (err) {
    // swallow; logging must not break handler
  }
  logFileInitialized = true;
}

function logDebug(payload: Record<string, unknown>) {
  const line = JSON.stringify({
    sessionId: "debug-session",
    runId: "pre-fix-server",
    ...payload,
    timestamp: Date.now(),
  });
  fs.appendFile(DEBUG_LOG_PATH, line + "\n", () => {
    // swallow errors to avoid impacting streaming
  });
}
// #endregion

export const config = {
  runtime: "nodejs",
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  ensureLogClearedOnce();

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

    // #region agent log
    logDebug({
      hypothesisId: "H1",
      location: "api/chat/stream:entry",
      message: "stream handler start",
      data: { chatId: finalChatId ?? null, model, contentLength: content.length },
    });
    // #endregion

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
    res.write(
      `data: ${JSON.stringify({
        connected: true,
        newChatId: finalChatId,
      })}\n\n`
    );
    if ((res as any).flush) (res as any).flush();

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

    const personaInstruction =
      "You are a fun, friendly, lightly comedic assistant. Keep responses concise, clear, and helpful.";

    const languageInstruction = (() => {
      if (!language || language === "auto") {
        return "Detect the user's language (likely Indonesian, Malay, or English). Respond in the detected language. Preserve nuance and meaning, avoid literal word-for-word translation.";
      }
      if (language === "english") {
        return "Respond in English. If the user writes in another language, translate and respond in English.";
      }
      return `Respond in ${languageName}. If the user writes in another language, translate and respond in ${languageName}.`;
    })();

    const systemPrompt = `${personaInstruction} ${languageInstruction}`;

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
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: content,
            },
          ],
        });

        let streamedLength = 0;

        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            const text = chunk.delta.text;
            fullAiContent += text;
            streamedLength += text.length;
            res.write(`data: ${JSON.stringify({ token: text })}\n\n`);
            // Force flush to send immediately
            if ((res as any).flush) (res as any).flush();
            // #region agent log
            logDebug({
              hypothesisId: "H2",
              location: "api/chat/stream:token",
              message: "anthropic token",
              data: { chunkLen: text.length, streamedLength },
            });
            // #endregion
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

        messages.unshift({
          role: "system",
          content: systemPrompt,
        });

        const apiModel = model === "chatgpt-5.1" ? "gpt-4o" : model;

        const stream = await openai.chat.completions.create({
          model: apiModel,
          messages: messages,
          stream: true,
        });

        let streamedLength = 0;

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) {
            fullAiContent += text;
            streamedLength += text.length;
            res.write(`data: ${JSON.stringify({ token: text })}\n\n`);
            // Force flush to send immediately
            if ((res as any).flush) (res as any).flush();
            // #region agent log
            logDebug({
              hypothesisId: "H2",
              location: "api/chat/stream:token",
              message: "openai token",
              data: { chunkLen: text.length, streamedLength },
            });
            // #endregion
          }
        }
      } else if (model.startsWith("gemini")) {
        if (!env.GOOGLE_API_KEY) throw new Error("Google API Key not found");
        const genAI = new GoogleGenerativeAI(env.GOOGLE_API_KEY);
        const geminiModel = genAI.getGenerativeModel({ model: model });

        const prompt = `${systemPrompt}\n\n${content}`;

        const result = await geminiModel.generateContentStream(prompt);
        let streamedLength = 0;

        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            fullAiContent += text;
            streamedLength += text.length;
            res.write(`data: ${JSON.stringify({ token: text })}\n\n`);
            // Force flush to send immediately
            if ((res as any).flush) (res as any).flush();
            // #region agent log
            logDebug({
              hypothesisId: "H2",
              location: "api/chat/stream:token",
              message: "gemini token",
              data: { chunkLen: text.length, streamedLength },
            });
            // #endregion
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

      // Generate title if this is the first AI response
      const messageCount = await db.message.count({
        where: { chatId: finalChatId },
      });

      if (messageCount === 2) {
        // Run asynchronously to not block the response
        void (async () => {
          try {
            const { createCaller } = await import("~/server/api/root");
            const caller = createCaller({ auth, db });
            await caller.chat.generateTitle({
              chatId: finalChatId,
              model: model,
            });
          } catch (error) {
            console.error("Background title generation failed:", error);
          }
        })();
      }

      // Send completion event
      res.write(
        `data: ${JSON.stringify({
          done: true,
          userMessageId: userMessage.id,
          aiMessageId: aiMessage.id,
          newChatId: !chatId ? finalChatId : undefined,
        })}\n\n`
      );
      if ((res as any).flush) (res as any).flush();

      // #region agent log
      logDebug({
        hypothesisId: "H1",
        location: "api/chat/stream:done",
        message: "stream complete",
        data: {
          chatId: finalChatId,
          userMessageId: userMessage.id,
          aiMessageId: aiMessage.id,
          contentLength: fullAiContent.length,
        },
      });
      // #endregion
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
      // #region agent log
      logDebug({
        hypothesisId: "H2",
        location: "api/chat/stream:error",
        message: "stream error",
        data: { chatId: finalChatId, error: (error as Error).message },
      });
      // #endregion
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
