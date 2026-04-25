-- Add shipping/tracking columns to orders table
-- Run this in Supabase SQL Editor

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS waybill_number TEXT,
  ADD COLUMN IF NOT EXISTS shipping_company TEXT,
  ADD COLUMN IF NOT EXISTS last_tracking_status TEXT,
  ADD COLUMN IF NOT EXISTS last_tracking_status_date TEXT,
  ADD COLUMN IF NOT EXISTS last_tracking_check TIMESTAMPTZ;

-- Index for fast lookups by waybill
CREATE INDEX IF NOT EXISTS idx_orders_waybill_number
  ON orders (waybill_number)
  WHERE waybill_number IS NOT NULL;
