-- Allow dynamic order statuses from system_settings (not limited to enum).
-- Existing enum values are preserved as text.

ALTER TABLE orders ALTER COLUMN status DROP DEFAULT;

ALTER TABLE orders
  ALTER COLUMN status TYPE TEXT USING status::text;

ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'pending';

DROP TYPE IF EXISTS order_status;
