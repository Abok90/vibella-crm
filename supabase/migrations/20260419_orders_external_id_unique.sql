-- Stop duplicate Shopify orders.
--
-- Shopify fires multiple webhook topics (orders/create, orders/updated,
-- orders/paid) at the same endpoint. The previous dedup query used
-- maybeSingle(), which errors when multiple rows already exist for an
-- external_order_id, silently returns null, and falls into the INSERT
-- branch — compounding the duplicates on every subsequent webhook.
--
-- 1) Collapse existing duplicates: keep the oldest row per
--    (external_order_id, source).
DELETE FROM orders a
USING orders b
WHERE a.external_order_id IS NOT NULL
  AND a.external_order_id = b.external_order_id
  AND a.source = b.source
  AND a.created_at > b.created_at;

-- 2) DB-level guarantee: one row per external order per source.
CREATE UNIQUE INDEX IF NOT EXISTS orders_external_order_id_source_uniq
  ON orders (external_order_id, source)
  WHERE external_order_id IS NOT NULL;
