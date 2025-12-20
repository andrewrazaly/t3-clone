"use client";

import * as React from "react";
import { Paperclip, Globe, ArrowUp } from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { type Model } from "./model-selector";
import { type Language } from "./language-selector";
import { useStreamMessage } from "~/hooks/use-stream-message";

export function MessageInput({ selectedChatId, selectedModel, selectedLanguage, onChatStarted, onStreamingContent }: { selectedChatId: string | null; selectedModel: Model; selectedLanguage: Language; onChatStarted?: (chatId: string) => void; onStreamingContent?: (content: string, isStreaming: boolean) => void }) {
    const [input, setInput] = React.useState("");
    const [isSearchEnabled, setIsSearchEnabled] = React.useState(false);
    const utils = api.useUtils();

    const { sendMessage, isStreaming, streamingContent } = useStreamMessage(
        async (data) => {
            // Parallelize invalidations for better performance
            const invalidations = [utils.chat.getAll.invalidate()];
            if (selectedChatId) {
                invalidations.push(utils.chat.getMessages.invalidate({ chatId: selectedChatId }));
            }
            if (data.newChatId) {
                invalidations.push(utils.chat.getMessages.invalidate({ chatId: data.newChatId }));
            }
            await Promise.all(invalidations);

            if (data.newChatId && onChatStarted) {
                onChatStarted(data.newChatId);
            }
        }
    );

    // Notify parent of streaming content changes
    React.useEffect(() => {
        onStreamingContent?.(streamingContent, isStreaming);
    }, [streamingContent, isStreaming, onStreamingContent]);

    const handleSend = async () => {
        if (!input.trim() || isStreaming) return;

        const messageContent = input;
        setInput("");

        await sendMessage({
            chatId: selectedChatId ?? undefined,
            content: messageContent,
            model: selectedModel.id,
            language: selectedLanguage.id,
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void handleSend();
        }
    };

    return (
        <div className="w-full max-w-3xl mx-auto p-3 md:p-4">
            <div className="relative flex flex-col bg-[var(--card)] border border-[var(--border)] rounded-xl md:rounded-xl shadow-sm focus-within:ring-1 focus-within:ring-[var(--ring)] overflow-visible">
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={selectedChatId ? `Message ${selectedModel.name}...` : "Send a message to start a new chat..."}
                    disabled={isStreaming}
                    className="w-full bg-transparent border-0 focus:ring-0 resize-none min-h-[52px] md:min-h-[60px] max-h-[160px] md:max-h-[200px] p-3 md:p-4 text-sm md:text-base text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] disabled:opacity-50 outline-none"
                    rows={1}
                    style={{ height: "auto" }}
                />

                <div className="flex items-center justify-between p-2 md:p-2 bg-[var(--card)] rounded-b-xl">
                    <div className="flex items-center gap-1 md:gap-2 relative">
                        <button
                            onClick={() => setIsSearchEnabled(!isSearchEnabled)}
                            className={cn(
                                "flex items-center gap-1 px-2 py-1 md:py-1.5 text-xs font-medium rounded-full transition-colors border",
                                isSearchEnabled
                                    ? "bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/20"
                                    : "text-[var(--muted-foreground)] border-transparent hover:bg-[var(--accent)]"
                            )}
                        >
                            <Globe className="h-3 w-3" />
                            <span className="hidden sm:inline">Search</span>
                        </button>

                        <button className="p-1 md:p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors rounded-md hover:bg-[var(--accent)]">
                            <Paperclip className="h-4 w-4" />
                        </button>
                    </div>

                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isStreaming}
                        className={cn(
                            "p-1.5 md:p-2 rounded-lg transition-all duration-200",
                            input.trim()
                                ? "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90"
                                : "bg-[var(--accent)] text-[var(--muted-foreground)] cursor-not-allowed"
                        )}
                    >
                        <ArrowUp className="h-4 w-4" />
                    </button>
                </div>
            </div>
            <div className="text-center text-[10px] md:text-xs text-[var(--muted-foreground)] mt-2 space-y-1">
                <div className="hidden sm:block">ChatGPT can make mistakes. Check important info.</div>
                <div className="text-[9px] md:text-[10px] opacity-70">v1.0.0</div>
            </div>
        </div>
    );
}

