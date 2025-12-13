
"use client";

import * as React from "react";
import { Sidebar, SidebarToggle } from "./sidebar";

//make an interface that looks modern saas
interface ChatLayoutProps {
    children: React.ReactNode;
    selectedChatId: string | null;
    onSelectChat: (id: string | null) => void;
}

export function ChatLayout({ children, selectedChatId, onSelectChat }: ChatLayoutProps) {
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

    return (
        <div className="flex h-screen overflow-hidden bg-[var(--background)]">
            <Sidebar
                isOpen={isSidebarOpen}
                toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                selectedChatId={selectedChatId}
                onSelectChat={onSelectChat}
                className="shrink-0"
            />
            <div className="flex-1 flex flex-col h-full relative">
                <SidebarToggle
                    isOpen={isSidebarOpen}
                    toggle={() => setIsSidebarOpen(!isSidebarOpen)}
                />
                <main className="flex-1 overflow-hidden flex flex-col">
                    {children}
                </main>
            </div>
        </div>
    );
}
