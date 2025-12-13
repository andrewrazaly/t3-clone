
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { type PrismaClient } from "@prisma/client";

// Mock environment variables to pass checks
vi.mock("~/env", () => ({
    env: {
        OPENAI_API_KEY: "mock-openai-key",
        ANTHROPIC_API_KEY: "mock-anthropic-key",
        GOOGLE_API_KEY: "mock-google-key",
        NODE_ENV: "test",
    },
}));

const mockCreateCompletion = vi.fn();

// Mock AI providers
vi.mock("openai", () => {
    return {
        default: class OpenAI {
            chat = {
                completions: {
                    create: mockCreateCompletion.mockResolvedValue({
                        choices: [{ message: { content: "Mock OpenAI Response" } }],
                    }),
                },
            };
        }
    };
});

vi.mock("@anthropic-ai/sdk", () => {
    return {
        default: class Anthropic {
            messages = {
                create: vi.fn().mockResolvedValue({
                    content: [{ type: "text", text: "Mock Claude Response" }],
                }),
            };
        }
    };
});

vi.mock("@google/generative-ai", () => {
    return {
        GoogleGenerativeAI: class GoogleGenerativeAI {
            getGenerativeModel() {
                return {
                    generateContent: vi.fn().mockResolvedValue({
                        response: { text: () => "Mock Gemini Response" },
                    }),
                };
            }
        },
    };
});

// Mock Prisma
const mockDb = {
    chat: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
    },
    message: {
        create: vi.fn(),
        findMany: vi.fn(),
    },
} as unknown as PrismaClient;

describe("Chat Router", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("create", () => {
        it("allows guest to create a chat (userId: null)", async () => {
            const ctx = createInnerTRPCContext({ auth: { userId: null } });
            ctx.db = mockDb;
            const caller = appRouter.createCaller(ctx);

            (mockDb.chat.create as any).mockResolvedValue({ id: "new-guest-chat", userId: null });

            const result = await caller.chat.create();
            expect(result.id).toBe("new-guest-chat");
            expect(mockDb.chat.create).toHaveBeenCalledWith({
                data: { title: "New Chat", userId: null },
            });
        });
    });

    describe("getChatsByIds", () => {
        it("returns guest chats for provided IDs", async () => {
            const ctx = createInnerTRPCContext({ auth: { userId: null } });
            ctx.db = mockDb;
            const caller = appRouter.createCaller(ctx);

            (mockDb.chat.findMany as any).mockResolvedValue([
                { id: "guest-1", userId: null },
            ]);

            const result = await caller.chat.getChatsByIds({ chatIds: ["guest-1"] });
            expect(result).toHaveLength(1);
            expect(mockDb.chat.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: {
                    id: { in: ["guest-1"] },
                    userId: null,
                }
            }));
        });
    });

    describe("sendMessage", () => {
        it("allows guest to send message with free model (gpt-3.5-turbo)", async () => {
            // Setup context
            const ctx = createInnerTRPCContext({ auth: { userId: null } });
            // Inject mock db
            ctx.db = mockDb;

            const caller = appRouter.createCaller(ctx);

            // Mock DB responses
            (mockDb.chat.create as any).mockResolvedValue({ id: "guest-chat-id", userId: null });
            (mockDb.chat.findUnique as any).mockResolvedValue({ id: "guest-chat-id", userId: null });
            (mockDb.message.create as any).mockResolvedValue({ id: "msg-id", content: "response" });

            const input = {
                content: "Hello",
                model: "gpt-3.5-turbo",
            };

            const result = await caller.chat.sendMessage(input);

            expect(result).toBeDefined();
            expect(mockDb.chat.create).toHaveBeenCalled(); // Should create new chat
        });

        it("allows guest to send message with free model (gemini-1.5-flash)", async () => {
            const ctx = createInnerTRPCContext({ auth: { userId: null } });
            ctx.db = mockDb;
            const caller = appRouter.createCaller(ctx);

            (mockDb.chat.create as any).mockResolvedValue({ id: "guest-chat-id-2", userId: null });
            (mockDb.chat.findUnique as any).mockResolvedValue({ id: "guest-chat-id-2", userId: null });
            (mockDb.message.create as any).mockResolvedValue({ id: "msg-id", content: "response" });

            const input = {
                content: "Hello",
                model: "gemini-1.5-flash",
            };

            await caller.chat.sendMessage(input);
            expect(mockDb.message.create).toHaveBeenCalled();
        });

        it("blocks guest from using premium model (chatgpt-5.1)", async () => {
            const ctx = createInnerTRPCContext({ auth: { userId: null } });
            ctx.db = mockDb;
            const caller = appRouter.createCaller(ctx);

            const input = {
                content: "Hello",
                model: "chatgpt-5.1",
            };

            await expect(caller.chat.sendMessage(input)).rejects.toThrow("You must be signed in to use this model");
        });

        it("allows signed-in user to use premium model", async () => {
            const ctx = createInnerTRPCContext({ auth: { userId: "user_123" } });
            ctx.db = mockDb;
            const caller = appRouter.createCaller(ctx);

            (mockDb.chat.create as any).mockResolvedValue({ id: "auth-chat-id", userId: "user_123" });
            (mockDb.chat.findUnique as any).mockResolvedValue({ id: "auth-chat-id", userId: "user_123" });
            (mockDb.message.create as any).mockResolvedValue({ id: "msg-id", content: "response" });

            const input = {
                content: "Hello",
                model: "chatgpt-5.1",
            };

            const result = await caller.chat.sendMessage(input);
            expect(result).toBeDefined();
        });

        it("generates correct prompt for Malay (Arabic) language", async () => {
            const ctx = createInnerTRPCContext({ auth: { userId: "user_123" } });
            ctx.db = mockDb;
            const caller = appRouter.createCaller(ctx);

            (mockDb.chat.findUnique as any).mockResolvedValue({ id: "chat-id", userId: "user_123" });
            (mockDb.message.create as any).mockResolvedValue({ id: "msg-id", content: "response" });

            const input = {
                content: "Hello",
                model: "gpt-3.5-turbo",
                language: "malay-arabic"
            };

            await caller.chat.sendMessage(input);

            expect(mockCreateCompletion).toHaveBeenCalledWith(
                expect.objectContaining({
                    messages: expect.arrayContaining([
                        expect.objectContaining({
                            role: "system",
                            content: expect.stringContaining("Malay (Jawi script)")
                        })
                    ])
                })
            );
        });
    });
});
