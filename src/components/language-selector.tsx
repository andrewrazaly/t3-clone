"use client";

import * as React from "react";
import { Check, Globe } from "lucide-react";
import { cn } from "~/lib/utils";

export const LANGUAGES = [
    { id: "english", name: "English" },
    { id: "bahasa-indonesia", name: "Bahasa Indonesia" },
    { id: "bahasa-melayu", name: "Bahasa Melayu" },
    { id: "malay-arabic", name: "Malay (Jawi)" },
] as const;

export type Language = (typeof LANGUAGES)[number];

interface LanguageSelectorProps {
    selectedLanguage: Language;
    onSelectLanguage: (language: Language) => void;
}

export function LanguageSelector({ selectedLanguage, onSelectLanguage }: LanguageSelectorProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm font-medium rounded-md hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] transition-colors"
            >
                <Globe className="h-3.5 w-3.5 md:h-4 md:w-4" />
                <span>{selectedLanguage.name}</span>
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-44 md:w-48 bg-[var(--popover)] border border-[var(--border)] rounded-md shadow-md z-50 py-1">
                    {LANGUAGES.map((language) => (
                        <button
                            key={language.id}
                            onClick={() => {
                                onSelectLanguage(language);
                                setIsOpen(false);
                            }}
                            className={cn(
                                "flex items-center w-full px-3 py-2 text-sm hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] transition-colors text-left",
                                selectedLanguage.id === language.id && "bg-[var(--accent)] text-[var(--accent-foreground)]"
                            )}
                        >
                            <span className="flex-1">{language.name}</span>
                            {selectedLanguage.id === language.id && <Check className="h-4 w-4" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
