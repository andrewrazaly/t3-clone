"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "~/lib/utils";

export const MODELS = [
    { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI" },
    { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", provider: "OpenAI" },
    { id: "claude-3-5-sonnet-20240620", name: "Claude 3.5 Sonnet", provider: "Anthropic" },
    { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", provider: "Google" },
];

export type Model = (typeof MODELS)[number];

interface ModelSelectorProps {
    selectedModel: Model;
    onSelectModel: (model: Model) => void;
}

export function ModelSelector({ selectedModel, onSelectModel }: ModelSelectorProps) {
    const [isOpen, setIsOpen] = React.useState(false);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] rounded-lg transition-colors"
            >
                <span className="text-lg font-semibold">{selectedModel.name}</span>
                <ChevronDown className="h-4 w-4 opacity-50" />
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute top-full left-0 mt-2 w-64 bg-[var(--popover)] border border-[var(--border)] rounded-xl shadow-lg py-1 z-50 overflow-hidden">
                        {MODELS.map((model) => (
                            <button
                                key={model.id}
                                onClick={() => {
                                    onSelectModel(model);
                                    setIsOpen(false);
                                }}
                                className={cn(
                                    "w-full text-left px-4 py-3 text-sm hover:bg-[var(--accent)] transition-colors flex flex-col gap-0.5",
                                    selectedModel.id === model.id && "bg-[var(--accent)]"
                                )}
                            >
                                <span className="font-medium text-[var(--foreground)]">{model.name}</span>
                                <span className="text-xs text-[var(--muted-foreground)]">{model.provider}</span>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
