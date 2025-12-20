import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
    console.log("Running migration: Add model and language to Message table");

    try {
        // Add model column
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "Message"
            ADD COLUMN IF NOT EXISTS "model" TEXT;
        `);
        console.log("✓ Added 'model' column");

        // Add language column
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "Message"
            ADD COLUMN IF NOT EXISTS "language" TEXT;
        `);
        console.log("✓ Added 'language' column");

        // Verify
        const result = await prisma.$queryRawUnsafe(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'Message'
            ORDER BY ordinal_position;
        `);

        console.log("\nCurrent Message table structure:");
        console.table(result);

        console.log("\n✅ Migration completed successfully!");
    } catch (error) {
        console.error("❌ Migration failed:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
