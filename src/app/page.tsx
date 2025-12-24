"use client";

import * as React from "react";
import { useAuth } from "@clerk/nextjs";
import { ChatLayout } from "~/components/chat-layout";
import { MessageList } from "~/components/message-list";
import { MessageInput } from "~/components/message-input";
import { ModelSelector, MODELS } from "~/components/model-selector";
import { LanguageSelector, LANGUAGES } from "~/components/language-selector";

export default function HomePage() {
    const { isSignedIn } = useAuth();
    const [selectedChatId, setSelectedChatId] = React.useState<string | null>(null);
    const [selectedModelId, setSelectedModelId] = React.useState<string>(MODELS[0]!.id);
    const [selectedLanguage, setSelectedLanguage] = React.useState<typeof LANGUAGES[number]>(
        LANGUAGES.find((l) => l.id === "auto") ?? LANGUAGES[0]
    );
    const [streamingContent, setStreamingContent] = React.useState("");
    const [isStreaming, setIsStreaming] = React.useState(false);
    const [pendingUserMessage, setPendingUserMessage] = React.useState<string | null>(null);

    const isAuthenticated = !!isSignedIn;
    const selectedModel = MODELS.find((m) => m.id === selectedModelId) ?? MODELS[0]!;

    const handleStreamingContent = React.useCallback((content: string, streaming: boolean) => {
        setStreamingContent(content);
        setIsStreaming(streaming);
    }, []);

    // Reset to free model if user signs out and a premium model was selected
    React.useEffect(() => {
        if (!isAuthenticated && selectedModel.isPremium) {
            const freeModel = MODELS.find(m => !m.isPremium);
            if (freeModel) {
                setSelectedModelId(freeModel.id);
            }
        }
    }, [isAuthenticated, selectedModel.isPremium]);

    return (
        <ChatLayout selectedChatId={selectedChatId} onSelectChat={setSelectedChatId}>
            <div className="flex flex-col h-full">
                {/* Header */}
                <div className="flex flex-col gap-2 p-3 md:p-4 border-b border-[var(--border)] ml-12 md:ml-0 bg-[var(--background)]/80 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                            <div className="h-9 w-9 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center font-semibold text-sm">AI</div>
                            <div className="flex flex-col">
                                <span className="text-sm md:text-base font-semibold text-[var(--foreground)]">Chat • Fun & Friendly</span>
                                <span className="text-xs text-[var(--muted-foreground)]">Auto-detect language · Comedic tone</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <ModelSelector
                                selectedModelId={selectedModelId}
                                onSelectModel={setSelectedModelId}
                                isAuthenticated={isAuthenticated}
                            />
                            <LanguageSelector selectedLanguage={selectedLanguage} onSelectLanguage={setSelectedLanguage} />
                        </div>
                    </div>
                </div>

                <MessageList
                    selectedChatId={selectedChatId}
                    streamingContent={streamingContent}
                    isStreaming={isStreaming}
                    pendingUserMessage={pendingUserMessage}
                />
                <MessageInput
                    selectedChatId={selectedChatId}
                    selectedModel={selectedModel}
                    selectedLanguage={selectedLanguage}
                    onChatStarted={setSelectedChatId}
                    onStreamingContent={handleStreamingContent}
                    onUserMessage={setPendingUserMessage}
                    onUserMessageSettled={() => setPendingUserMessage(null)}
                />
            </div>
        </ChatLayout>
    );
}
