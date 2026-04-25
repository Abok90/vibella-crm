-- Split product price and shipping fee from orders.total so the dashboard
-- and jard page don't have to regex-parse notes. The columns exist in the
-- base schema but are declared NOT NULL without a default, which blocks
-- inserts from createOrderAction (it only writes total). Make them optional
-- with a 0 default and backfill NULLs.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_fee DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10, 2);

ALTER TABLE orders ALTER COLUMN shipping_fee DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN subtotal DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN shipping_fee SET DEFAULT 0;
ALTER TABLE orders ALTER COLUMN subtotal SET DEFAULT 0;

UPDATE orders SET shipping_fee = 0 WHERE shipping_fee IS NULL;
UPDATE orders SET subtotal = 0 WHERE subtotal IS NULL;
