"use client";

import * as React from "react";
import { Paperclip, Globe, ArrowUp } from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { type Model } from "./model-selector";
import { type Language } from "./language-selector";

export function MessageInput({ selectedChatId, selectedModel, selectedLanguage }: { selectedChatId: string | null; selectedModel: Model; selectedLanguage: Language }) {
    const [input, setInput] = React.useState("");
    const [isSearchEnabled, setIsSearchEnabled] = React.useState(false);
    const utils = api.useUtils();

    const sendMessage = api.chat.sendMessage.useMutation({
        onSuccess: async () => {
            await utils.chat.getMessages.invalidate({ chatId: selectedChatId! });
            await utils.chat.getAll.invalidate();
        },
    });

    const handleSend = () => {
        if (!input.trim() || !selectedChatId) return;

        sendMessage.mutate({
            chatId: selectedChatId,
            content: input,
            model: selectedModel.id,
            language: selectedLanguage.id,
        });
        setInput("");
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="w-full max-w-3xl mx-auto p-4">
            <div className="relative flex flex-col bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-sm focus-within:ring-1 focus-within:ring-[var(--ring)] overflow-visible">
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={selectedChatId ? `Message ${selectedModel.name}...` : "Select a chat to start messaging..."}
                    disabled={!selectedChatId || sendMessage.isPending}
                    className="w-full bg-transparent border-0 focus:ring-0 resize-none min-h-[60px] max-h-[200px] p-4 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] disabled:opacity-50 outline-none"
                    rows={1}
                    style={{ height: "auto" }}
                />

                <div className="flex items-center justify-between p-2 bg-[var(--card)] rounded-b-xl">
                    <div className="flex items-center gap-2 relative">
                        <button
                            onClick={() => setIsSearchEnabled(!isSearchEnabled)}
                            className={cn(
                                "flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-full transition-colors border",
                                isSearchEnabled
                                    ? "bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/20"
                                    : "text-[var(--muted-foreground)] border-transparent hover:bg-[var(--accent)]"
                            )}
                        >
                            <Globe className="h-3 w-3" />
                            <span>Search</span>
                        </button>

                        <button className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors rounded-md hover:bg-[var(--accent)]">
                            <Paperclip className="h-4 w-4" />
                        </button>
                    </div>

                    <button
                        onClick={handleSend}
                        disabled={!selectedChatId || !input.trim() || sendMessage.isPending}
                        className={cn(
                            "p-2 rounded-lg transition-all duration-200",
                            input.trim()
                                ? "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90"
                                : "bg-[var(--accent)] text-[var(--muted-foreground)] cursor-not-allowed"
                        )}
                    >
                        <ArrowUp className="h-4 w-4" />
                    </button>
                </div>
            </div>
            <div className="text-center text-xs text-[var(--muted-foreground)] mt-2">
                ChatGPT can make mistakes. Check important info.
            </div>
        </div>
    );
}

