-- Add whatsapp_history JSONB column to orders table to track sent messages per status
ALTER TABLE orders ADD COLUMN IF NOT EXISTS whatsapp_history JSONB DEFAULT '{}'::jsonb;
