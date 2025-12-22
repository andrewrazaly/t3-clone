"use client";

import * as React from "react";
import { Plus, MessageSquare, PanelLeftClose, PanelLeftOpen, Pencil } from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useAuth, useUser, UserButton } from "@clerk/nextjs";
import Link from "next/link";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
    isOpen: boolean;
    toggleSidebar: () => void;
    selectedChatId: string | null;
    onSelectChat: (chatId: string | null) => void;
}

export function Sidebar({ className, isOpen, selectedChatId, onSelectChat }: SidebarProps) {
    const { isSignedIn } = useAuth();
    const { user } = useUser();
    const utils = api.useUtils();

    // State for guest chat IDs stored in localStorage
    const [guestChatIds, setGuestChatIds] = React.useState<string[]>([]);

    // State for editing titles
    const [editingChatId, setEditingChatId] = React.useState<string | null>(null);
    const [editingTitle, setEditingTitle] = React.useState("");
    const editInputRef = React.useRef<HTMLInputElement>(null);

    // Load guest chat IDs on mount
    React.useEffect(() => {
        if (!isSignedIn) {
            const stored = localStorage.getItem("guest_chat_ids");
            if (stored) {
                try {
                    const parsed: unknown = JSON.parse(stored);
                    if (Array.isArray(parsed)) {
                        // Filter out non-string items to prevent Zod errors
                        const validIds = parsed.filter((id): id is string => typeof id === "string");
                        setGuestChatIds(validIds);
                    }
                } catch (e) {
                    console.error("Failed to parse guest chat IDs", e);
                }
            }
        }
    }, [isSignedIn]);

    // Fetch authenticated user chats
    const { data: userChats } = api.chat.getAll.useQuery(undefined, {
        enabled: !!isSignedIn,
    });

    // Fetch guest chats based on IDs from localStorage
    const { data: guestChats } = api.chat.getChatsByIds.useQuery(
        { chatIds: guestChatIds },
        { enabled: !isSignedIn && guestChatIds.length > 0 }
    );

    const chats = isSignedIn ? userChats : guestChats;

    const createChat = api.chat.create.useMutation({
        onSuccess: async (newChat) => {
            if (isSignedIn) {
                await utils.chat.getAll.invalidate();
            } else {
                // Save new guest chat ID
                const updatedIds = [newChat.id, ...guestChatIds];
                setGuestChatIds(updatedIds);
                localStorage.setItem("guest_chat_ids", JSON.stringify(updatedIds));
                await utils.chat.getChatsByIds.invalidate();
            }
            onSelectChat(newChat.id);
        },
    });

    const updateTitle = api.chat.updateTitle.useMutation({
        onSuccess: async () => {
            if (isSignedIn) {
                await utils.chat.getAll.invalidate();
            } else {
                await utils.chat.getChatsByIds.invalidate();
            }
            setEditingChatId(null);
        },
        onError: (error) => {
            console.error("Failed to update title:", error);
            setEditingChatId(null);
        },
    });

    const handleNewChat = () => {
        createChat.mutate();
    };

    const handleStartEdit = (chatId: string, currentTitle: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingChatId(chatId);
        setEditingTitle(currentTitle);
    };

    const handleSaveEdit = (chatId: string) => {
        if (!editingTitle.trim()) {
            setEditingChatId(null);
            return;
        }
        updateTitle.mutate({ chatId, title: editingTitle.trim() });
    };

    const handleCancelEdit = () => {
        setEditingChatId(null);
        setEditingTitle("");
    };

    // Focus input when editing starts
    React.useEffect(() => {
        if (editingChatId && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingChatId]);

    return (
        <div
            className={cn(
                "flex flex-col h-full bg-[var(--sidebar-background)] text-[var(--sidebar-foreground)] transition-all duration-300 ease-in-out border-r border-[var(--sidebar-border)]",
                // Mobile: fixed overlay, Desktop: normal sidebar
                "md:relative fixed inset-y-0 left-0 z-40",
                isOpen ? "w-[260px]" : "w-0 md:w-0 -translate-x-full md:translate-x-0 opacity-0 overflow-hidden",
                isOpen && "translate-x-0 opacity-100",
                className
            )}
        >
            <div className="p-3 flex-1 overflow-y-auto">
                <button
                    onClick={handleNewChat}
                    disabled={createChat.isPending}
                    className="flex items-center gap-3 w-full px-3 py-3 rounded-md border border-[var(--sidebar-border)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)] transition-colors text-sm text-left mb-4 disabled:opacity-50"
                >
                    <Plus className="h-4 w-4" />
                    <span className="font-medium">New chat</span>
                </button>

                <div className="flex flex-col gap-2">
                    <div className="text-xs font-medium text-[var(--sidebar-foreground)]/50 px-3 py-2">
                        History
                    </div>
                    {chats && chats.length > 0 ? (
                        chats.map((chat) => (
                            <div
                                key={chat.id}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-3 text-sm rounded-md hover:bg-[var(--sidebar-accent)] transition-colors group",
                                    selectedChatId === chat.id && "bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)]"
                                )}
                            >
                                <MessageSquare className="h-4 w-4 shrink-0" />
                                {editingChatId === chat.id ? (
                                    <input
                                        ref={editInputRef}
                                        type="text"
                                        value={editingTitle}
                                        onChange={(e) => setEditingTitle(e.target.value)}
                                        onBlur={() => handleSaveEdit(chat.id)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                handleSaveEdit(chat.id);
                                            } else if (e.key === "Escape") {
                                                handleCancelEdit();
                                            }
                                        }}
                                        className="flex-1 bg-[var(--sidebar-background)] border border-[var(--sidebar-border)] rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <>
                                        <button
                                            onClick={() => onSelectChat(chat.id)}
                                            className="flex-1 text-left truncate"
                                        >
                                            <span className="truncate">{chat.title}</span>
                                        </button>
                                        <button
                                            onClick={(e) => handleStartEdit(chat.id, chat.title, e)}
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[var(--sidebar-accent)] rounded transition-opacity"
                                            title="Edit title"
                                        >
                                            <Pencil className="h-3 w-3" />
                                        </button>
                                    </>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="px-3 py-2 text-sm text-[var(--muted-foreground)]">
                            {isSignedIn ? "No history yet" : "No unsaved history"}
                        </div>
                    )}
                </div>
            </div>

            <div className="p-3 border-t border-[var(--sidebar-border)]">
                {isSignedIn && user ? (
                    <div className="flex items-center gap-3 px-3 py-3 text-sm rounded-md">
                        <UserButton afterSignOutUrl="/" />
                        <div className="font-medium truncate">{user.fullName ?? user.firstName ?? "User"}</div>
                    </div>
                ) : (
                    <Link href="/auth/signin" className="flex items-center gap-3 px-3 py-3 text-sm rounded-md hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)] cursor-pointer transition-colors">
                        <div className="h-8 w-8 rounded-full bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)] flex items-center justify-center font-medium">
                            G
                        </div>
                        <div className="font-medium">Sign in</div>
                    </Link>
                )}
            </div>
        </div>
    );
}

export function SidebarToggle({ isOpen, toggle }: { isOpen: boolean; toggle: () => void }) {
    return (
        <button
            onClick={toggle}
            className="fixed top-3 left-3 z-50 p-2 rounded-md bg-[var(--background)] border border-[var(--border)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] transition-colors shadow-sm md:top-2 md:left-2 md:bg-transparent md:border-0 md:shadow-none"
            aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
        >
            {isOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
        </button>
    );
}
