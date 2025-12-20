import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
    console.log("Verifying database schema...\n");

    try {
        // Get Message table structure
        const messageColumns = await prisma.$queryRawUnsafe(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'Message'
            ORDER BY ordinal_position;
        `);

        console.log("Message table structure:");
        console.table(messageColumns);

        // Get Chat table structure
        const chatColumns = await prisma.$queryRawUnsafe(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'Chat'
            ORDER BY ordinal_position;
        `);

        console.log("\nChat table structure:");
        console.table(chatColumns);

        console.log("\n✅ Schema verification complete!");

    } catch (error) {
        console.error("❌ Schema verification failed:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
