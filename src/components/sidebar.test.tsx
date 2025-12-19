import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-empty-function, @typescript-eslint/no-unsafe-call */
import { render, screen, cleanup } from "@testing-library/react";
import { Sidebar } from './sidebar';

const mocks = vi.hoisted(() => ({
    useAuth: vi.fn(),
    useUser: vi.fn(),
}));

// Mock the hooks and components
vi.mock('~/trpc/react', () => ({
    api: {
        useUtils: () => ({
            chat: {
                getAll: { invalidate: vi.fn() },
                getChatsByIds: { invalidate: vi.fn() }
            }
        }),
        chat: {
            getAll: { useQuery: () => ({ data: [] }) },
            create: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
            getChatsByIds: { useQuery: () => ({ data: [] }) },
        },
    },
}));

vi.mock('@clerk/nextjs', () => ({
    useAuth: mocks.useAuth,
    useUser: mocks.useUser,
    SignOutButton: () => <button>Sign Out Button</button>,
    UserButton: () => <div>User Button</div>,
}));

// Mock Lucide icons
vi.mock('lucide-react', () => ({
    Plus: () => <span>Plus</span>,
    MessageSquare: () => <span>MessageSquare</span>,
    PanelLeftClose: () => <span>Close</span>,
    PanelLeftOpen: () => <span>Open</span>,
}));

// Mock Link
vi.mock('next/link', () => ({
    default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

describe('Sidebar Component', () => {
    beforeEach(() => {
        mocks.useAuth.mockReturnValue({ isSignedIn: false });
        mocks.useUser.mockReturnValue({ user: null });
    });

    afterEach(() => {
        cleanup();
    });

    it('renders sign in button when not authenticated', () => {
        render(
            <Sidebar
                isOpen={true}
                toggleSidebar={() => { }}
                selectedChatId={null}
                onSelectChat={() => { }}
            />
        );

        expect(screen.getByText('Sign in')).toBeDefined();
        expect(screen.queryByText('Sign Out Button')).toBeNull();
    });

    it('renders user info and sign out button when authenticated', () => {
        // Override mock for authenticated state
        mocks.useAuth.mockReturnValue({ isSignedIn: true });
        mocks.useUser.mockReturnValue({
            user: { firstName: 'Test', fullName: 'Test User' },
        });

        render(
            <Sidebar
                isOpen={true}
                toggleSidebar={() => { }}
                selectedChatId={null}
                onSelectChat={() => { }}
            />
        );

        expect(screen.getByText('Test User')).toBeDefined();
        expect(screen.queryByText('Sign in')).toBeNull();
    });
});
