-- ============================================================
-- SOVEREIGN DB SCHEMA v2 — additive migration
-- Safe to run against a v1 database: all statements use
-- ADD COLUMN IF NOT EXISTS / ON CONFLICT guards.
-- ============================================================

-- defects: workflow status column
ALTER TABLE defects
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK(status IN ('OPEN','REVIEWED','CONFIRMED','DISMISSED','ESCALATED'));

-- rule_runs: optional error message for partial failures
ALTER TABLE rule_runs
  ADD COLUMN IF NOT EXISTS error TEXT;

-- rulepacks: which rule IDs were active in this run
ALTER TABLE rulepacks
  ADD COLUMN IF NOT EXISTS rule_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
