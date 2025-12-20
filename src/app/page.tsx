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
        LANGUAGES.find((l) => l.id === "bahasa-indonesia") ?? LANGUAGES[0]
    );
    const [streamingContent, setStreamingContent] = React.useState("");
    const [isStreaming, setIsStreaming] = React.useState(false);

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
                <div className="flex items-center justify-between p-3 md:p-4 border-b border-[var(--border)] ml-12 md:ml-0">
                    <ModelSelector
                        selectedModelId={selectedModelId}
                        onSelectModel={setSelectedModelId}
                        isAuthenticated={isAuthenticated}
                    />
                    <LanguageSelector selectedLanguage={selectedLanguage} onSelectLanguage={setSelectedLanguage} />
                </div>

                <MessageList
                    selectedChatId={selectedChatId}
                    streamingContent={streamingContent}
                    isStreaming={isStreaming}
                />
                <MessageInput
                    selectedChatId={selectedChatId}
                    selectedModel={selectedModel}
                    selectedLanguage={selectedLanguage}
                    onChatStarted={setSelectedChatId}
                    onStreamingContent={handleStreamingContent}
                />
            </div>
        </ChatLayout>
    );
}
