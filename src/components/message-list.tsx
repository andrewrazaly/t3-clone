"use client";

import * as React from "react";
import { cn } from "~/lib/utils";
import { User, Bot, Loader2 } from "lucide-react";
import { api } from "~/trpc/react";

export function MessageList({ selectedChatId, isSubmitting }: { selectedChatId: string | null; isSubmitting?: boolean }) {
    const { data: messages, isLoading } = api.chat.getMessages.useQuery(
        { chatId: selectedChatId! },
        { enabled: !!selectedChatId }
    );

    const bottomRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

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
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {messages?.map((message) => (
                <div
                    key={message.id}
                    className={cn(
                        "flex gap-4 max-w-3xl mx-auto",
                        message.role === "user" ? "justify-end" : "justify-start"
                    )}
                >
                    {message.role === "assistant" && (
                        <div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center shrink-0 text-[var(--primary-foreground)]">
                            <Bot className="h-5 w-5" />
                        </div>
                    )}

                    <div
                        className={cn(
                            "rounded-lg px-4 py-2 max-w-[80%]",
                            message.role === "user"
                                ? "bg-[var(--secondary)] text-[var(--secondary-foreground)]"
                                : "text-[var(--foreground)]"
                        )}
                    >
                        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                    </div>

                    {message.role === "user" && (
                        <div className="w-8 h-8 rounded-full bg-[var(--sidebar-primary)] flex items-center justify-center shrink-0 text-[var(--sidebar-primary-foreground)]">
                            <User className="h-5 w-5" />
                        </div>
                    )}
                </div>
            ))}

            {/* Loading indicator when AI is thinking */}
            {isSubmitting && (
                <div className="flex gap-4 max-w-3xl mx-auto justify-start animate-in fade-in duration-300">
                    <div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center shrink-0 text-[var(--primary-foreground)]">
                        <Bot className="h-5 w-5" />
                    </div>
                    <div className="rounded-lg px-4 py-2 bg-[var(--accent)] text-[var(--foreground)]">
                        <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm text-[var(--muted-foreground)]">Thinking...</span>
                        </div>
                    </div>
                </div>
            )}

            <div ref={bottomRef} />
        </div>
    );
}
