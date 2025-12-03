"use client";

import * as React from "react";
import { Plus, MessageSquare, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
    isOpen: boolean;
    toggleSidebar: () => void;
    selectedChatId: string | null;
    onSelectChat: (chatId: string | null) => void;
}

export function Sidebar({ className, isOpen, selectedChatId, onSelectChat }: SidebarProps) {
    const utils = api.useUtils();
    const { data: chats } = api.chat.getAll.useQuery();
    const createChat = api.chat.create.useMutation({
        onSuccess: async (newChat) => {
            await utils.chat.getAll.invalidate();
            onSelectChat(newChat.id);
        },
    });

    const handleNewChat = () => {
        createChat.mutate();
    };

    return (
        <div
            className={cn(
                "flex flex-col h-full bg-[var(--sidebar-background)] text-[var(--sidebar-foreground)] transition-all duration-300 ease-in-out border-r border-[var(--sidebar-border)]",
                isOpen ? "w-[260px]" : "w-0 opacity-0 overflow-hidden",
                className
            )}
        >
            <div className="p-3 flex-1 overflow-y-auto">
                <button
                    onClick={handleNewChat}
                    disabled={createChat.isPending}
                    className="flex items-center gap-3 w-full px-3 py-3 rounded-md border border-[var(--sidebar-border)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)] transition-colors text-sm text-left mb-4"
                >
                    <Plus className="h-4 w-4" />
                    <span className="font-medium">New chat</span>
                </button>

                <div className="flex flex-col gap-2">
                    <div className="text-xs font-medium text-[var(--sidebar-foreground)]/50 px-3 py-2">
                        History
                    </div>
                    {chats?.map((chat) => (
                        <button
                            key={chat.id}
                            onClick={() => onSelectChat(chat.id)}
                            className={cn(
                                "flex items-center gap-3 px-3 py-3 text-sm rounded-md hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)] transition-colors text-left truncate",
                                selectedChatId === chat.id && "bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)]"
                            )}
                        >
                            <MessageSquare className="h-4 w-4 shrink-0" />
                            <span className="truncate">{chat.title}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-3 border-t border-[var(--sidebar-border)]">
                <div className="flex items-center gap-3 px-3 py-3 text-sm rounded-md hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)] cursor-pointer transition-colors">
                    <div className="h-8 w-8 rounded-full bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)] flex items-center justify-center font-medium">
                        U
                    </div>
                    <div className="font-medium">User</div>
                </div>
            </div>
        </div>
    );
}

export function SidebarToggle({ isOpen, toggle }: { isOpen: boolean; toggle: () => void }) {
    return (
        <button
            onClick={toggle}
            className="fixed top-2 left-2 z-50 p-2 rounded-md hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] transition-colors md:hidden"
        >
            {isOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
        </button>
    );
}
