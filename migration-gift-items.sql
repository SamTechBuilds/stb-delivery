-- Migration: delivery_gift_items table
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/nlsmlaivhxsfjoxmhvqw/sql)
-- This creates the gift items table that stores files inside the gift box.

CREATE TABLE IF NOT EXISTS delivery_gift_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  title       text NOT NULL CHECK (char_length(title) <= 200),
  description text CHECK (description IS NULL OR char_length(description) <= 500),
  storage_path text NOT NULL,
  file_name   text NOT NULL CHECK (char_length(file_name) <= 200),
  mime_type   text NOT NULL,
  size_bytes  bigint NOT NULL CHECK (size_bytes >= 0),
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups by delivery
CREATE INDEX IF NOT EXISTS idx_gift_items_delivery ON delivery_gift_items(delivery_id);

-- Enable RLS
ALTER TABLE delivery_gift_items ENABLE ROW LEVEL SECURITY;

-- Policy: owner can do everything (same pattern as delivery_assets)
CREATE POLICY "Owner full access on gift items"
  ON delivery_gift_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM deliveries d
      JOIN projects p ON p.id = d.project_id
      JOIN clients c ON c.id = p.client_id
      WHERE d.id = delivery_gift_items.delivery_id
        AND c.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM deliveries d
      JOIN projects p ON p.id = d.project_id
      JOIN clients c ON c.id = p.client_id
      WHERE d.id = delivery_gift_items.delivery_id
        AND c.owner_id = auth.uid()
    )
  );

-- Grant access to authenticated users (RLS handles the rest)
GRANT SELECT, INSERT, UPDATE, DELETE ON delivery_gift_items TO authenticated;
