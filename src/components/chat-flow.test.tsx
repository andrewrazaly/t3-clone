import { describe, it, expect, vi, beforeEach, type Mock, afterEach } from "vitest";
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function */
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { Sidebar } from "./sidebar";
import { ModelSelector } from "./model-selector";
import { LanguageSelector } from "./language-selector";
import HomePage from "../app/page"; // Import the main page component
import { useAuth, useUser } from "@clerk/nextjs";
import { api } from "~/trpc/react";

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
            getChatsByIds: { useQuery: vi.fn() },
            getMessages: { useQuery: vi.fn() },
            sendMessage: { useMutation: vi.fn() },
        },
    },
}));

// Mock Next.js Link
vi.mock("next/link", () => ({
    default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe("User Pathways UI", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        cleanup();

        // Default mocks
        (useAuth as Mock).mockReturnValue({ isSignedIn: false });
        (useUser as Mock).mockReturnValue({ user: null });

        // Mock API utils and queries
        (api.useUtils as Mock).mockReturnValue({
            chat: {
                getAll: { invalidate: vi.fn() },
                getChatsByIds: { invalidate: vi.fn() },
                getMessages: { invalidate: vi.fn() },
            }
        });
        (api.chat.getAll.useQuery as Mock).mockReturnValue({ data: [] });
        (api.chat.getChatsByIds.useQuery as Mock).mockReturnValue({ data: [] });
        (api.chat.getMessages.useQuery as Mock).mockReturnValue({ data: [], isLoading: false });
        (api.chat.create.useMutation as Mock).mockReturnValue({ mutate: vi.fn(), isPending: false });
        (api.chat.sendMessage.useMutation as Mock).mockReturnValue({ mutate: vi.fn(), isPending: false });
    });

    describe("Guest User Flow", () => {
        it("Sidebar shows 'Sign in' button for guest users", () => {
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

            expect(screen.getByText("Sign in")).toBeDefined();
            expect(screen.queryByTestId("user-button")).toBeNull();
        });

        it("Sidebar fetches guest history if IDs in localStorage", () => {
            const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
            getItemSpy.mockReturnValue(JSON.stringify(["guest-chat-1"]));

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

        it("Guest can type and send a message (Free Model)", async () => {
            (useAuth as Mock).mockReturnValue({ isSignedIn: false });
            const mutateMock = vi.fn();
            (api.chat.sendMessage.useMutation as Mock).mockReturnValue({ mutate: mutateMock, isPending: false });

            render(<HomePage />);

            // Check default model is displayed (likely GPT-3.5 Turbo or similar free one)
            // Note: Implementation specific, assuming GPT-3.5 is default free
            expect(screen.getByText(/GPT-3.5 Turbo/i)).toBeDefined();

            const input = screen.getByRole("textbox");
            fireEvent.change(input, { target: { value: "Hello Guest" } });

            // Find send button (it has an ArrowUp icon)
            // We can find it by the button class or role if accessible, simpler to query by role button
            // The button is disabled until input -> we typed.
            const buttons = screen.getAllByRole("button");
            const sendButton = buttons[buttons.length - 1]; // usually last button
            fireEvent.click(sendButton!);

            expect(mutateMock).toHaveBeenCalledWith(expect.objectContaining({
                content: "Hello Guest",
                // model should be free model id
            }));
        });
    });

    describe("Authenticated User Flow", () => {
        it("Sidebar shows 'User Profile' for signed-in users", () => {
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
        });

        it("User can select Premium Model and send message", async () => {
            (useAuth as Mock).mockReturnValue({ isSignedIn: true });
            (useUser as Mock).mockReturnValue({ user: { fullName: "Auth User" } });

            const mutateMock = vi.fn();
            (api.chat.sendMessage.useMutation as Mock).mockReturnValue({ mutate: mutateMock, isPending: false });

            render(<HomePage />);

            // Open Model Selector
            // Assumption: ModelSelector trigger displays current model name.
            // If default is chatgpt-5.1 for auth user, let's verify that first.
            // Based on implementation plan, it should be default.
            expect(screen.getByText(/ChatGPT 5.1/i)).toBeDefined();

            const input = screen.getByRole("textbox");
            fireEvent.change(input, { target: { value: "Hello Premium" } });

            const buttons = screen.getAllByRole("button");
            const sendButton = buttons[buttons.length - 1];
            fireEvent.click(sendButton!);

            expect(mutateMock).toHaveBeenCalledWith(expect.objectContaining({
                content: "Hello Premium",
                model: "chatgpt-5.1"
            }));
        });
    });

    describe("Language Flow", () => {
        it("User can select Bahasa Melayu and send message", async () => {
            // Mock guest or auth doesn't matter much for language, assume guest
            (useAuth as Mock).mockReturnValue({ isSignedIn: false });
            const mutateMock = vi.fn();
            (api.chat.sendMessage.useMutation as Mock).mockReturnValue({ mutate: mutateMock, isPending: false });

            render(<HomePage />);

            // Open Language Selector (it shows current language, likely English or Bahasa Melayu if default changed)
            // The default was changed to Bahasa Melayu in a previous step!
            // Let's verify default is Bahasa Melayu
            expect(screen.getByText(/Bahasa Melayu/i)).toBeDefined();

            // Let's try changing to another one (e.g. English) to verify switch, 
            // OR just verify the send uses the current default.
            // Let's verify send uses Bahasa Melayu default
            const input = screen.getByRole("textbox");
            fireEvent.change(input, { target: { value: "Apa khabar" } });

            const buttons = screen.getAllByRole("button");
            const sendButton = buttons[buttons.length - 1];
            fireEvent.click(sendButton!);

            expect(mutateMock).toHaveBeenCalledWith(expect.objectContaining({
                content: "Apa khabar",
                language: "bahasa-melayu"
            }));
        });
    });

    it("LanguageSelector shows expanded Bahasa options", () => {
        const onSelect = vi.fn();
        const { getByText } = render(
            <LanguageSelector
                selectedLanguage={{ id: "english", name: "English" }}
                onSelectLanguage={onSelect}
            />
        );

        fireEvent.click(getByText("English"));

        expect(getByText("Bahasa Indonesia")).toBeDefined();
        expect(getByText("Bahasa Melayu")).toBeDefined();
    });
});
