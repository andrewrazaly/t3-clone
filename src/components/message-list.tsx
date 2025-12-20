"use client";

import * as React from "react";
import { cn } from "~/lib/utils";
import { User, Bot, Loader2 } from "lucide-react";
import { api } from "~/trpc/react";

export function MessageList({ selectedChatId, streamingContent, isStreaming }: { selectedChatId: string | null; streamingContent?: string; isStreaming?: boolean }) {
    const { data: messages, isLoading } = api.chat.getMessages.useQuery(
        { chatId: selectedChatId! },
        { enabled: !!selectedChatId }
    );

    const bottomRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, streamingContent]);

    if (!selectedChatId) {
        return (
            <div className="flex-1 flex items-center justify-center text-[var(--muted-foreground)]">
                Select or create a chat to start messaging.
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center text-[var(--muted-foreground)]">
                Loading messages...
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6">
            {messages?.map((message) => (
                <div
                    key={message.id}
                    className={cn(
                        "flex gap-3 md:gap-4 max-w-3xl mx-auto px-2 md:px-0",
                        message.role === "user" ? "justify-end" : "justify-start"
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
                        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                    </div>

                    {message.role === "user" && (
                        <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-[var(--sidebar-primary)] flex items-center justify-center shrink-0 text-[var(--sidebar-primary-foreground)]">
                            <User className="h-4 w-4 md:h-5 md:w-5" />
                        </div>
                    )}
                </div>
            ))}

            {/* Streaming response */}
            {isStreaming && streamingContent && (
                <div className="flex gap-3 md:gap-4 max-w-3xl mx-auto px-2 md:px-0 justify-start animate-in fade-in duration-300">
                    <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-[var(--primary)] flex items-center justify-center shrink-0 text-[var(--primary-foreground)]">
                        <Bot className="h-4 w-4 md:h-5 md:w-5" />
                    </div>
                    <div className="rounded-lg px-3 py-2 md:px-4 md:py-2 text-[var(--foreground)] text-sm md:text-base">
                        <p className="whitespace-pre-wrap leading-relaxed">{streamingContent}</p>
                    </div>
                </div>
            )}

            {/* Loading indicator when waiting for first token */}
            {isStreaming && !streamingContent && (
                <div className="flex gap-3 md:gap-4 max-w-3xl mx-auto px-2 md:px-0 justify-start animate-in fade-in duration-300">
                    <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-[var(--primary)] flex items-center justify-center shrink-0 text-[var(--primary-foreground)]">
                        <Bot className="h-4 w-4 md:h-5 md:w-5" />
                    </div>
                    <div className="rounded-lg px-3 py-2 md:px-4 md:py-2 bg-[var(--accent)] text-[var(--foreground)]">
                        <div className="flex items-center gap-2">
                            <Loader2 className="h-3 w-3 md:h-4 md:w-4 animate-spin" />
                            <span className="text-xs md:text-sm text-[var(--muted-foreground)]">Thinking...</span>
                        </div>
                    </div>
                </div>
            )}

            <div ref={bottomRef} />
        </div>
    );
}
