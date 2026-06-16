-- Migration: 0012_webhook_delivery_refinements
-- Add is_test flag for synthetic test deliveries, composite index for query performance

ALTER TABLE webhook_deliveries ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_config_created
  ON webhook_deliveries(webhook_config_id, created_at DESC);
