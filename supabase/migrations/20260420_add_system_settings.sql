-- system_settings is used by src/app/actions/system.ts to persist arbitrary
-- key/value configuration (e.g. Shopify credentials, theme defaults). The
-- table was referenced in code but never created, so every upsert was failing
-- silently and reads returned null.
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
