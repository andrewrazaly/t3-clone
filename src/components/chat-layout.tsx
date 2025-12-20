
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
    // Check if screen is desktop size (md breakpoint = 768px)
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

    // Set sidebar open by default on desktop
    React.useEffect(() => {
        const checkScreenSize = () => {
            setIsSidebarOpen(window.innerWidth >= 768);
        };

        // Set initial state
        checkScreenSize();

        // Add listener for window resize
        window.addEventListener('resize', checkScreenSize);
        return () => window.removeEventListener('resize', checkScreenSize);
    }, []);

    return (
        <div className="flex h-screen overflow-hidden bg-[var(--background)]">
            <Sidebar
                isOpen={isSidebarOpen}
                toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                selectedChatId={selectedChatId}
                onSelectChat={(chatId) => {
                    onSelectChat(chatId);
                    // Close sidebar on mobile after selecting a chat
                    setIsSidebarOpen(false);
                }}
                className="shrink-0"
            />
            {/* Backdrop for mobile */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}
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
