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

interface UseStreamMessageReturn {
  sendMessage: (params: StreamMessageParams) => Promise<void>;
  isStreaming: boolean;
  streamingContent: string;
  error: string | null;
}

export function useStreamMessage(
  onComplete?: (data: { newChatId?: string }) => void | Promise<void>
): UseStreamMessageReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (params: StreamMessageParams) => {
      setIsStreaming(true);
      setStreamingContent("");
      setError(null);

      try {
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
                continue;
              } else if (data.error) {
                setError(data.error);
              } else if (data.token) {
                setStreamingContent((prev) => prev + data.token);
              } else if (data.done) {
                setIsStreaming(false);
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
    [onComplete]
  );

  return {
    sendMessage,
    isStreaming,
    streamingContent,
    error,
  };
}
