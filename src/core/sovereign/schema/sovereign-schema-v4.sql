-- sovereign-schema-v4.sql
-- Additive migration: add entity_type + entity_id to audit_events
-- for per-entity lineage queries (finding, defect trace lookup).
-- Safe to apply after v1/v2/v3 — all existing rows get NULL for both columns.

ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS entity_id   TEXT;

-- Partial index: only covers rows that actually reference an entity,
-- keeping the index small for the common case of aggregate audit rows.
CREATE INDEX IF NOT EXISTS idx_audit_entity
  ON audit_events(case_id, entity_type, entity_id)
  WHERE entity_type IS NOT NULL;
