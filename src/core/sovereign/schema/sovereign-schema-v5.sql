-- sovereign-schema-v5.sql
-- Additive migration:
--   1. owner_email on cases (Google OAuth scoping)
--   2. claim_excerpts join table  → ASSERTS edges (excerpt → claim)
--   3. claim_derives  join table  → DERIVES_FROM edges (child_claim → parent_claim)
--
-- Safe to apply after v1/v2/v3/v4 — all existing rows get NULL for new columns.

ALTER TABLE cases ADD COLUMN IF NOT EXISTS owner_email TEXT;

CREATE INDEX IF NOT EXISTS idx_cases_owner
  ON cases(owner_email)
  WHERE owner_email IS NOT NULL;

-- -----------------------------------------------------------------------
-- P1 pipeline: claim_excerpts
-- Each row says "this excerpt supports this claim".
-- graph-populator creates ASSERTS edges from these rows.
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS claim_excerpts (
  claim_id   TEXT NOT NULL REFERENCES claims(claim_id)   ON DELETE CASCADE,
  excerpt_id TEXT NOT NULL REFERENCES excerpts(excerpt_id) ON DELETE CASCADE,
  relevance  NUMERIC(4,3) NOT NULL DEFAULT 1.0
    CHECK (relevance >= 0 AND relevance <= 1),
  PRIMARY KEY (claim_id, excerpt_id)
);

CREATE INDEX IF NOT EXISTS idx_claim_excerpts_claim
  ON claim_excerpts(claim_id);

-- -----------------------------------------------------------------------
-- P1 pipeline: claim_derives
-- Each row says "child_claim derives from parent_claim".
-- graph-populator creates DERIVES_FROM edges from these rows.
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS claim_derives (
  child_claim_id  TEXT NOT NULL REFERENCES claims(claim_id) ON DELETE CASCADE,
  parent_claim_id TEXT NOT NULL REFERENCES claims(claim_id) ON DELETE CASCADE,
  PRIMARY KEY (child_claim_id, parent_claim_id)
);

CREATE INDEX IF NOT EXISTS idx_claim_derives_child
  ON claim_derives(child_claim_id);
