
import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient({
    datasourceUrl: "postgresql://postgres.rvgindsfxoismejnliyd:way!evp4yjy!ufn0FGZ@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true",
});

async function main() {
    console.log("Verifying Database Connection...");
    try {
        // 1. Unauthenticated / Guest Chat handling
        console.log("1. Testing Guest Chat Creation...");
        const guestChat = await prisma.chat.create({
            data: {
                title: "Verification Chat",
                userId: null,
            },
        });
        console.log("✅ Guest Chat Created:", guestChat.id);

        // 2. Message Persistence
        console.log("2. Testing Message Persistence...");
        const message = await prisma.message.create({
            data: {
                chatId: guestChat.id,
                content: "Hello from verification script",
                role: "user",
            },
        });
        console.log("✅ Message Persisted:", message.id);

        // 3. Retrieval
        console.log("3. Testing Data Retrieval...");
        const storedChat = await prisma.chat.findUnique({
            where: { id: guestChat.id },
            include: { messages: true },
        });

        if (!storedChat) throw new Error("Chat not found after creation");
        if (storedChat.messages.length !== 1) throw new Error("Message not found in chat");
        console.log("✅ Data Retrieval Successful");

        // Cleanup
        console.log("Cleaning up...");
        await prisma.chat.delete({ where: { id: guestChat.id } });
        console.log("✅ Cleanup Complete");
        console.log("SUCCESS: Database is fully operational and persistent.");
    } catch (e) {
        console.error("FAILURE: Database verification failed");
        console.error(e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
