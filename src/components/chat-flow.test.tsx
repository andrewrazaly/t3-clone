import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function */
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { Sidebar } from "./sidebar";
import { ModelSelector } from "./model-selector";
import { LanguageSelector } from "./language-selector";
import { useAuth, useUser } from "@clerk/nextjs";
import { api } from "~/trpc/react";
import { afterEach } from "vitest";

// Mock Clerk hooks
vi.mock("@clerk/nextjs", () => ({
    useAuth: vi.fn(),
    useUser: vi.fn(),
    UserButton: () => <div data-testid="user-button">User Button</div>,
    SignOutButton: ({ children }: any) => <button>{children}</button>,
}));

// Mock TRPC
vi.mock("~/trpc/react", () => ({
    api: {
        useUtils: vi.fn(),
        chat: {
            getAll: { useQuery: vi.fn() },
            create: { useMutation: vi.fn() },
            getChatsByIds: { useQuery: vi.fn() }, // Add new query mock
        },
    },
}));

// Mock Next.js Link
vi.mock("next/link", () => ({
    default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

describe("User Pathways UI", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        cleanup(); // Ensure cleanup before each test

        // Default mocks
        (useAuth as Mock).mockReturnValue({ isSignedIn: false });
        (useUser as Mock).mockReturnValue({ user: null });

        // Mock API utils and queries
        (api.useUtils as Mock).mockReturnValue({
            chat: {
                getAll: { invalidate: vi.fn() },
                getChatsByIds: { invalidate: vi.fn() },
            }
        });
        (api.chat.getAll.useQuery as Mock).mockReturnValue({ data: [] });
        (api.chat.getChatsByIds.useQuery as Mock).mockReturnValue({ data: [] }); // Default empty guest chats
        (api.chat.create.useMutation as Mock).mockReturnValue({ mutate: vi.fn(), isPending: false });
    });

    describe("Guest User Flow", () => {
        it("Sidebar shows 'Sign in' button for guest users", () => {
            // Setup Guest State
            (useAuth as Mock).mockReturnValue({ isSignedIn: false });
            (useUser as Mock).mockReturnValue({ user: null });

            render(
                <Sidebar
                    isOpen={true}
                    toggleSidebar={() => { }}
                    selectedChatId={null}
                    onSelectChat={() => { }}
                />
            );

            // Check for Sign in link
            const signInLink = screen.getByText("Sign in");
            expect(signInLink).toBeDefined();
            expect(screen.queryByTestId("user-button")).toBeNull();
        });

        it("Sidebar fetches guest history if IDs in localStorage", () => {
            // Mock LocalStorage
            const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
            getItemSpy.mockReturnValue(JSON.stringify(["guest-chat-1"]));

            // Mock response for getChatsByIds
            (api.chat.getChatsByIds.useQuery as Mock).mockReturnValue({
                data: [{ id: "guest-chat-1", title: "Unsaved Chat" }]
            });

            render(
                <Sidebar
                    isOpen={true}
                    toggleSidebar={() => { }}
                    selectedChatId={null}
                    onSelectChat={() => { }}
                />
            );

            expect(screen.getByText("Unsaved Chat")).toBeDefined();
        });

        it("ModelSelector disables premium models for guest users", () => {
            render(
                <ModelSelector
                    selectedModelId="gpt-3.5-turbo"
                    onSelectModel={() => { }}
                    isAuthenticated={false}
                />
            );

            expect(screen.getByText("GPT-3.5 Turbo")).toBeDefined();
        });
    });

    describe("Authenticated User Flow", () => {
        it("Sidebar shows 'User Profile' for signed-in users", () => {
            // Setup Auth State
            (useAuth as Mock).mockReturnValue({ isSignedIn: true });
            (useUser as Mock).mockReturnValue({ user: { fullName: "Test User" } });

            render(
                <Sidebar
                    isOpen={true}
                    toggleSidebar={() => { }}
                    selectedChatId={null}
                    onSelectChat={() => { }}
                />
            );

            expect(screen.queryByText("Sign in")).toBeNull();
            expect(screen.getByTestId("user-button")).toBeDefined();
            expect(screen.getByText("Test User")).toBeDefined();
        });
    });

    it("LanguageSelector shows expanded Bahasa options", () => {
        const onSelect = vi.fn();
        const { getByText, queryByText } = render(
            <LanguageSelector
                selectedLanguage={{ id: "english", name: "English" }}
                onSelectLanguage={onSelect}
            />
        );

        // Open dropdown
        fireEvent.click(getByText("English"));

        // Check for new options
        expect(getByText("Bahasa Indonesia")).toBeDefined();
        expect(getByText("Bahasa Melayu")).toBeDefined();
    });
});
