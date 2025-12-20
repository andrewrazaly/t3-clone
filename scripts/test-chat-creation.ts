import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
    console.log("Testing chat creation and message flow...\n");

    try {
        // Create a test chat
        const chat = await prisma.chat.create({
            data: {
                title: "Test Chat",
                userId: "test_user_123",
            },
        });
        console.log("✓ Created chat:", chat);

        // Create a test message
        const message = await prisma.message.create({
            data: {
                chatId: chat.id,
                content: "Hello, this is a test message",
                role: "user",
                model: "gpt-3.5-turbo",
                language: "bahasa-indonesia",
            },
        });
        console.log("✓ Created message:", message);

        // Fetch chats for user
        const userChats = await prisma.chat.findMany({
            where: {
                userId: "test_user_123",
            },
            include: {
                messages: true,
            },
        });
        console.log("\n✓ User chats:");
        console.table(userChats);

        // Clean up test data
        await prisma.message.delete({ where: { id: message.id } });
        await prisma.chat.delete({ where: { id: chat.id } });
        console.log("\n✓ Test data cleaned up");

        console.log("\n✅ All tests passed! Database is working correctly.");
    } catch (error) {
        console.error("❌ Test failed:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
