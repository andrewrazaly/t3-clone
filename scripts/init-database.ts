import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
    console.log("Initializing database with complete schema...");

    try {
        // Create Chat table
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Chat" (
                "id" TEXT PRIMARY KEY,
                "title" TEXT NOT NULL,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "userId" TEXT
            );
        `);
        console.log("✓ Created Chat table");

        // Create Message table with model and language columns
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Message" (
                "id" TEXT PRIMARY KEY,
                "content" TEXT NOT NULL,
                "role" TEXT NOT NULL,
                "model" TEXT,
                "language" TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "chatId" TEXT NOT NULL,
                CONSTRAINT "Message_chatId_fkey" FOREIGN KEY ("chatId")
                    REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE
            );
        `);
        console.log("✓ Created Message table");

        // Create Post table (legacy from T3 stack)
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Post" (
                "id" SERIAL PRIMARY KEY,
                "name" TEXT NOT NULL,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "createdById" TEXT NOT NULL
            );
        `);
        console.log("✓ Created Post table");

        // Create indexes
        await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "Post_name_idx" ON "Post"("name");
        `);
        await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "Message_chatId_idx" ON "Message"("chatId");
        `);
        await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "Chat_userId_idx" ON "Chat"("userId");
        `);
        console.log("✓ Created indexes");

        // Verify tables
        const tables = await prisma.$queryRawUnsafe(`
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY tablename;
        `);

        console.log("\n✅ Database initialized successfully!");
        console.log("\nTables created:");
        console.table(tables);

    } catch (error) {
        console.error("❌ Database initialization failed:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
