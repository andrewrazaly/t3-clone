import { useState, useCallback } from "react";

interface StreamMessageParams {
  chatId?: string;
  content: string;
  model: string;
  language?: string;
}

interface StreamResponse {
  connected?: boolean;
  token?: string;
  done?: boolean;
  error?: string;
  userMessageId?: string;
  aiMessageId?: string;
  newChatId?: string;
}

interface StreamCallbacks {
  onConnected?: (data: { newChatId?: string }) => void | Promise<void>;
  onComplete?: (data: { newChatId?: string }) => void | Promise<void>;
}

interface UseStreamMessageReturn {
  sendMessage: (params: StreamMessageParams) => Promise<void>;
  isStreaming: boolean;
  streamingContent: string;
  error: string | null;
}

export function useStreamMessage(
  callbacks?: StreamCallbacks
): UseStreamMessageReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (params: StreamMessageParams) => {
      setIsStreaming(true);
      setStreamingContent("");
      setError(null);
      let streamedLength = 0;

      // #region agent log
      fetch("http://127.0.0.1:7243/ingest/b2731f27-0823-4a25-97fe-e90cef5a35e7", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "debug-session",
          runId: "pre-fix",
          hypothesisId: "H1",
          location: "use-stream-message.ts:sendMessage",
          message: "sendMessage start",
          data: { chatId: params.chatId ?? null, model: params.model },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion

      try {
        const { onConnected, onComplete } = callbacks ?? {};

        const response = await fetch("/api/chat/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(params),
        });

        if (!response.ok) {
          const errorData = await response.json() as { error?: string };
          throw new Error(errorData.error ?? "Failed to send message");
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error("No response body");
        }

        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = JSON.parse(line.slice(6)) as StreamResponse;

              if (data.connected) {
                // Stream connection established, continue waiting for tokens
                // #region agent log
                fetch("http://127.0.0.1:7243/ingest/b2731f27-0823-4a25-97fe-e90cef5a35e7", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    sessionId: "debug-session",
                    runId: "pre-fix",
                    hypothesisId: "H1",
                    location: "use-stream-message.ts:connected",
                    message: "stream connected",
                    data: { newChatId: data.newChatId ?? null },
                    timestamp: Date.now(),
                  }),
                }).catch(() => {});
                // #endregion
                await onConnected?.({ newChatId: data.newChatId });
                continue;
              } else if (data.error) {
                setError(data.error);
              } else if (data.token) {
                setStreamingContent((prev: string) => prev + data.token);
                streamedLength += data.token.length;
                // #region agent log
                fetch("http://127.0.0.1:7243/ingest/b2731f27-0823-4a25-97fe-e90cef5a35e7", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    sessionId: "debug-session",
                    runId: "pre-fix",
                    hypothesisId: "H2",
                    location: "use-stream-message.ts:token",
                    message: "token received",
                    data: { chunkLen: data.token.length, streamedLength },
                    timestamp: Date.now(),
                  }),
                }).catch(() => {});
                // #endregion
              } else if (data.done) {
                setIsStreaming(false);
                // #region agent log
                fetch("http://127.0.0.1:7243/ingest/b2731f27-0823-4a25-97fe-e90cef5a35e7", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    sessionId: "debug-session",
                    runId: "pre-fix",
                    hypothesisId: "H1",
                    location: "use-stream-message.ts:done",
                    message: "stream done",
                    data: { newChatId: data.newChatId ?? null, streamedLength },
                    timestamp: Date.now(),
                  }),
                }).catch(() => {});
                // #endregion
                await onComplete?.({ newChatId: data.newChatId });
              }
            }
          }
        }
      } catch (err) {
        console.error("Streaming error:", err);
        setError((err as Error).message);
        setIsStreaming(false);
      }
    },
    [callbacks]
  );

  return {
    sendMessage,
    isStreaming,
    streamingContent,
    error,
  };
}
