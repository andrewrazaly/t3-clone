"use client";

import * as React from "react";
import { ChatLayout } from "~/components/chat-layout";
import { MessageList } from "~/components/message-list";
import { MessageInput } from "~/components/message-input";
import { ModelSelector, MODELS } from "~/components/model-selector";
import { LanguageSelector, LANGUAGES } from "~/components/language-selector";

export default function HomePage() {
    const [selectedChatId, setSelectedChatId] = React.useState<string | null>(null);
    const [selectedModel, setSelectedModel] = React.useState(MODELS[0]!);
    const [selectedLanguage, setSelectedLanguage] = React.useState<typeof LANGUAGES[number]>(LANGUAGES[0]);

    return (
        <ChatLayout selectedChatId={selectedChatId} onSelectChat={setSelectedChatId}>
            <div className="flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
                    <ModelSelector selectedModel={selectedModel} onSelectModel={setSelectedModel} />
                    <LanguageSelector selectedLanguage={selectedLanguage} onSelectLanguage={setSelectedLanguage} />
                </div>

                <MessageList selectedChatId={selectedChatId} />
                <MessageInput
                    selectedChatId={selectedChatId}
                    selectedModel={selectedModel}
                    selectedLanguage={selectedLanguage}
                />
            </div>
        </ChatLayout>
    );
}
