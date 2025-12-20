-- Migration: Add model and language tracking to Message table
-- Run this in your Supabase SQL Editor

-- Add model column to Message table (nullable for backward compatibility)
ALTER TABLE "Message"
ADD COLUMN IF NOT EXISTS "model" TEXT;

-- Add language column to Message table (nullable for backward compatibility)
ALTER TABLE "Message"
ADD COLUMN IF NOT EXISTS "language" TEXT;

-- Optional: Add indexes for better query performance
CREATE INDEX IF NOT EXISTS "Message_model_idx" ON "Message"("model");
CREATE INDEX IF NOT EXISTS "Message_language_idx" ON "Message"("language");

-- Verify the changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'Message'
ORDER BY ordinal_position;
