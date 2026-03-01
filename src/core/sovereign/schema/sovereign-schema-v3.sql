-- ============================================================
-- SOVEREIGN DB SCHEMA v3 — additive migration
-- Adds the counters relational table so COUNTER graph nodes
-- can be populated by graph-populator.ts.
-- Safe to run against a v1 or v2 database.
-- ============================================================

CREATE TABLE IF NOT EXISTS counters (
  counter_id    TEXT PRIMARY KEY,
  case_id       TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
  decision_id   TEXT NOT NULL REFERENCES decisions(decision_id) ON DELETE CASCADE,
  counter_type  TEXT NOT NULL DEFAULT 'OBJECTION'
                  CHECK(counter_type IN ('OBJECTION','REBUTTAL','MITIGATION')),
  title         TEXT NOT NULL,
  text          TEXT NOT NULL,
  author        TEXT,
  counter_date  DATE,
  meta          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_counters_case     ON counters(case_id);
CREATE INDEX IF NOT EXISTS idx_counters_decision ON counters(decision_id);
