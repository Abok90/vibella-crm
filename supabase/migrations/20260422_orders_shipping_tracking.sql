-- Shipping tracking: store the courier's waybill number on each order and
-- cache the latest status we scraped from the courier portal so the UI can
-- show it without hitting the portal on every render.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS waybill_number TEXT,
  ADD COLUMN IF NOT EXISTS shipping_company TEXT,
  ADD COLUMN IF NOT EXISTS last_tracking_status TEXT,
  ADD COLUMN IF NOT EXISTS last_tracking_status_date TEXT,
  ADD COLUMN IF NOT EXISTS last_tracking_check TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_waybill ON orders (waybill_number);
