"use client";

import * as React from "react";
import { Lock, Cpu, Sparkles, Zap } from "lucide-react";
import { cn } from "~/lib/utils";

export interface Model {
    id: string;
    name: string;
    description: string;
    icon: React.ElementType;
    isPremium: boolean;
}

export const MODELS: Model[] = [
    {
        id: "chatgpt-5.1",
        name: "ChatGPT 5.1",
        description: "Newest, smartest model",
        icon: Sparkles,
        isPremium: true,
    },
    {
        id: "gpt-4o",
        name: "GPT-4o",
        description: "Smartest model",
        icon: Sparkles,
        isPremium: true,
    },
    {
        id: "claude-3-haiku-20240307",
        name: "Claude 3 Haiku",
        description: "Fast & Capable",
        icon: Cpu,
        isPremium: true,
    },
    {
        id: "gpt-3.5-turbo",
        name: "GPT-3.5 Turbo",
        description: "Fast and cheap",
        icon: Zap,
        isPremium: false,
    },
    // Gemini models temporarily disabled - see BUGS.md
    // {
    //     id: "gemini-1.5-flash",
    //     name: "Gemini Flash",
    //     description: "Fastest Google model",
    //     icon: Zap,
    //     isPremium: false,
    // },
    // {
    //     id: "gemini-1.5-pro",
    //     name: "Gemini Pro",
    //     description: "Capable Google model",
    //     icon: Sparkles,
    //     isPremium: true,
    // },
];

interface ModelSelectorProps {
    selectedModelId: string;
    onSelectModel: (modelId: string) => void;
    isAuthenticated: boolean;
}

export function ModelSelector({ selectedModelId, onSelectModel, isAuthenticated }: ModelSelectorProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    const selectedModel = MODELS.find((m) => m.id === selectedModelId) ?? MODELS[0];
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 text-xs md:text-sm font-medium rounded-lg hover:bg-[var(--accent)] transition-colors text-[var(--foreground)]"
            >
                <span className="truncate max-w-[120px] md:max-w-none">{selectedModel?.name}</span>
                <span className="text-[var(--muted-foreground)] text-xs">▼</span>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 md:w-72 p-1 bg-[var(--popover)] border border-[var(--border)] rounded-xl shadow-lg z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="space-y-1">
                        <div className="px-2 py-1.5 text-xs font-semibold text-[var(--muted-foreground)]">
                            Select Model
                        </div>
                        {MODELS.map((model) => {
                            const isLocked = model.isPremium && !isAuthenticated;
                            const isSelected = selectedModelId === model.id;

                            return (
                                <button
                                    key={model.id}
                                    onClick={() => {
                                        if (!isLocked) {
                                            onSelectModel(model.id);
                                            setIsOpen(false);
                                        }
                                    }}
                                    disabled={isLocked}
                                    className={cn(
                                        "w-full flex items-center justify-between px-2 py-2 rounded-lg text-left transition-colors",
                                        isSelected ? "bg-[var(--accent)]" : "hover:bg-[var(--accent)]",
                                        isLocked && "opacity-50 cursor-not-allowed hover:bg-transparent"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "flex items-center justify-center w-8 h-8 rounded-md bg-[var(--background)] border border-[var(--border)]",
                                            isSelected && "border-[var(--primary)] text-[var(--primary)]"
                                        )}>
                                            <model.icon className="w-4 h-4" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-[var(--foreground)]">
                                                {model.name}
                                            </span>
                                            <span className="text-xs text-[var(--muted-foreground)]">
                                                {model.description}
                                            </span>
                                        </div>
                                    </div>
                                    {isLocked && <Lock className="w-3 h-3 text-[var(--muted-foreground)]" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
