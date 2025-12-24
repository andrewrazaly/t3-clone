"use client";

import * as React from "react";
import { cn } from "~/lib/utils";
import { User, Bot, Loader2 } from "lucide-react";
import { api } from "~/trpc/react";

type CombinedMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    isStreaming?: boolean;
    isPlaceholder?: boolean;
};

export function MessageList({ selectedChatId, streamingContent, isStreaming, pendingUserMessage }: { selectedChatId: string | null; streamingContent?: string; isStreaming?: boolean; pendingUserMessage?: string | null }) {
    const { data: messages } = api.chat.getMessages.useQuery(
        { chatId: selectedChatId! },
        {
            enabled: !!selectedChatId,
            keepPreviousData: true,
            staleTime: 5_000,
        }
    );

    const bottomRef = React.useRef<HTMLDivElement>(null);

    const latestAssistantContent = React.useMemo(() => {
        if (!messages || messages.length === 0) return null;
        for (let i = messages.length - 1; i >= 0; i -= 1) {
            if (messages[i]?.role === "assistant") {
                return messages[i]?.content ?? null;
            }
        }
        return null;
    }, [messages]);

    // Build a seamless list: persisted messages + optimistic user + streaming assistant
    const combinedMessages = React.useMemo<CombinedMessage[]>(() => {
        const base: CombinedMessage[] = (messages ?? []).map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
        }));

        if (pendingUserMessage) {
            const alreadyExists = base.length > 0 && base[base.length - 1]?.content === pendingUserMessage && base[base.length - 1]?.role === "user";
            if (!alreadyExists) {
                base.push({
                    id: "pending-user",
                    role: "user",
                    content: pendingUserMessage,
                });
            }
        }

        if (isStreaming) {
            if (streamingContent) {
                base.push({
                    id: "streaming-assistant",
                    role: "assistant",
                    content: streamingContent,
                    isStreaming: true,
                });
            } else {
                base.push({
                    id: "streaming-wait",
                    role: "assistant",
                    content: "",
                    isPlaceholder: true,
                });
            }
        }
        // If streaming just finished but the assistant message isn't in persisted data yet, keep showing it
        if (!isStreaming && streamingContent && streamingContent !== latestAssistantContent) {
            base.push({
                id: "ephemeral-assistant-final",
                role: "assistant",
                content: streamingContent,
                isStreaming: true,
            });
        }

        // #region agent log
        fetch("http://127.0.0.1:7243/ingest/b2731f27-0823-4a25-97fe-e90cef5a35e7", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                sessionId: "debug-session",
                runId: "pre-fix",
                hypothesisId: "H4",
                location: "message-list.tsx:combinedMessages",
                message: "combinedMessages computed",
                data: {
                    selectedChatId,
                    persistedCount: messages?.length ?? 0,
                    hasPendingUser: !!pendingUserMessage,
                    streamingContentLength: streamingContent?.length ?? 0,
                    isStreaming: !!isStreaming,
                    combinedCount: base.length,
                },
                timestamp: Date.now(),
            }),
        }).catch(() => {});
        // #endregion

        return base;
    }, [messages, pendingUserMessage, isStreaming, streamingContent]);

    React.useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [combinedMessages]);

    if (!selectedChatId && combinedMessages.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center text-[var(--muted-foreground)]">
                Select or create a chat to start messaging.
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6">
            {combinedMessages.map((message) => (
                <div
                    key={message.id}
                    className={cn(
                        "flex gap-3 md:gap-4 max-w-3xl mx-auto px-2 md:px-0",
                        message.role === "user" ? "justify-end" : "justify-start",
                        message.isStreaming && "animate-in fade-in duration-300"
                    )}
                >
                    {message.role === "assistant" && (
                        <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-[var(--primary)] flex items-center justify-center shrink-0 text-[var(--primary-foreground)]">
                            <Bot className="h-4 w-4 md:h-5 md:w-5" />
                        </div>
                    )}

                    <div
                        className={cn(
                            "rounded-lg px-3 py-2 md:px-4 md:py-2 max-w-[85%] md:max-w-[80%] text-sm md:text-base",
                            message.role === "user"
                                ? "bg-[var(--secondary)] text-[var(--secondary-foreground)]"
                                : "text-[var(--foreground)]"
                        )}
                    >
                        {message.isPlaceholder ? (
                            <div className="flex items-center gap-2">
                                <Loader2 className="h-3 w-3 md:h-4 md:w-4 animate-spin" />
                                <span className="text-xs md:text-sm text-[var(--muted-foreground)]">Thinking...</span>
                            </div>
                        ) : (
                            <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                        )}
                    </div>

                    {message.role === "user" && (
                        <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-[var(--sidebar-primary)] flex items-center justify-center shrink-0 text-[var(--sidebar-primary-foreground)]">
                            <User className="h-4 w-4 md:h-5 md:w-5" />
                        </div>
                    )}
                </div>
            ))}

            <div ref={bottomRef} />
        </div>
    );
}
