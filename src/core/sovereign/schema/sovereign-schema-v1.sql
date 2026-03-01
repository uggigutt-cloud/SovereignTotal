-- ============================================================
-- SOVEREIGN DB SCHEMA v1 (PGLite / Postgres)
-- ============================================================

DO $$ BEGIN
  CREATE TYPE stage_code AS ENUM ('A','B','C','D','E','F','G');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE artifact_type AS ENUM (
    'PDF','DOCX','EMAIL','NOTE','AUDIO','VIDEO','IMAGE','TEXT','UNKNOWN'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE excerpt_kind AS ENUM (
    'OCR_TEXT','NATIVE_TEXT','TRANSCRIPTION','ANNOTATION','SYSTEM'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE entity_type AS ENUM (
    'PERSON','ORG','COURT','LAW','PLACE','DATE','CASE_ID','OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE claim_type AS ENUM (
    'FACT','PROCEDURE','DECISION','HEARSAY','INTERPRETATION','HYPOTHESIS'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE eclass AS ENUM ('E1','E2','E3','E4');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE node_type AS ENUM (
    'DOCUMENT','EXCERPT','CLAIM','DECISION','RULE','DEFECT','REMEDY','COUNTER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE edge_type AS ENUM (
    'CONTAINS',
    'ASSERTS',
    'SUPPORTS',
    'DERIVES_FROM',
    'VIOLATES',
    'INFECTS',
    'COUNTERS',
    'REFERENCES'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE defect_category AS ENUM (
    'HOMELESMANGEL',
    'KOMPETANSEMANGEL',
    'UTREDNINGSPLIKTBRUDD',
    'KONTRADIKSJONSPARTSRETT',
    'BEGRUNNELSESMANGEL',
    'FEIL_FAKTUM_INNHOLD',
    'DATAINTEGRITET_TAUSHET',
    'EMK_PROSESS'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tier_code AS ENUM ('T1','T2','T3','T4');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE finding_severity AS ENUM ('INFO','LOW','MED','HIGH','CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS cases (
  case_id            TEXT PRIMARY KEY,
  title              TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locale             TEXT NOT NULL DEFAULT 'nb-NO',
  notes              TEXT
);

CREATE TABLE IF NOT EXISTS documents (
  doc_id             TEXT PRIMARY KEY,
  case_id            TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
  artifact_type      artifact_type NOT NULL DEFAULT 'UNKNOWN',
  filename           TEXT,
  sha256             TEXT,
  mime_type          TEXT,
  stage              stage_code,
  doc_date           DATE,
  received_date      DATE,
  source_label       TEXT,
  is_primary_source  BOOLEAN NOT NULL DEFAULT FALSE,
  chain_of_custody   JSONB NOT NULL DEFAULT '{}'::jsonb,
  meta               JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS excerpts (
  excerpt_id         TEXT PRIMARY KEY,
  doc_id             TEXT NOT NULL REFERENCES documents(doc_id) ON DELETE CASCADE,
  kind               excerpt_kind NOT NULL DEFAULT 'NATIVE_TEXT',
  page_no            INTEGER,
  char_start         INTEGER NOT NULL DEFAULT 0,
  char_end           INTEGER NOT NULL DEFAULT 0,
  text               TEXT NOT NULL,
  normalized_text    TEXT,
  language           TEXT NOT NULL DEFAULT 'nb',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (char_end >= char_start)
);

CREATE TABLE IF NOT EXISTS entities (
  entity_id          TEXT PRIMARY KEY,
  excerpt_id         TEXT NOT NULL REFERENCES excerpts(excerpt_id) ON DELETE CASCADE,
  type               entity_type NOT NULL,
  value              TEXT NOT NULL,
  char_start         INTEGER,
  char_end           INTEGER,
  confidence         REAL,
  meta               JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS claims (
  claim_id           TEXT PRIMARY KEY,
  case_id            TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
  claim_type         claim_type NOT NULL,
  stage              stage_code,
  claim_text         TEXT NOT NULL,
  claim_date         DATE,
  subject_ref        TEXT,
  eclass             eclass NOT NULL DEFAULT 'E3',
  ewi                REAL NOT NULL DEFAULT 0.0,
  independence_score REAL NOT NULL DEFAULT 0.0,
  contradiction_score REAL NOT NULL DEFAULT 0.0,
  requires_review    BOOLEAN NOT NULL DEFAULT TRUE,
  meta               JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ewi >= 0 AND ewi <= 1),
  CHECK (independence_score >= 0 AND independence_score <= 1),
  CHECK (contradiction_score >= 0 AND contradiction_score <= 1)
);

CREATE TABLE IF NOT EXISTS decisions (
  decision_id        TEXT PRIMARY KEY,
  case_id            TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
  stage              stage_code NOT NULL,
  title              TEXT NOT NULL,
  decided_date       DATE,
  authority          TEXT,
  outcome            TEXT,
  meta               JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rules (
  rule_id            TEXT PRIMARY KEY,
  kind               TEXT NOT NULL,
  citation           TEXT NOT NULL,
  jurisdiction       TEXT NOT NULL DEFAULT 'NO',
  summary            TEXT,
  meta               JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS defects (
  defect_id          TEXT PRIMARY KEY,
  case_id            TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
  category           defect_category NOT NULL,
  tier               tier_code NOT NULL,
  stage              stage_code,
  title              TEXT NOT NULL,
  description        TEXT NOT NULL,
  confidence         REAL NOT NULL DEFAULT 0.0,
  rule_id            TEXT REFERENCES rules(rule_id),
  primary_excerpt_id TEXT REFERENCES excerpts(excerpt_id),
  meta               JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE TABLE IF NOT EXISTS remedies (
  remedy_id          TEXT PRIMARY KEY,
  jurisdiction       TEXT NOT NULL DEFAULT 'NO',
  name               TEXT NOT NULL,
  description        TEXT NOT NULL,
  typical_deadline   TEXT,
  requirements       JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS defect_remedies (
  defect_id          TEXT NOT NULL REFERENCES defects(defect_id) ON DELETE CASCADE,
  remedy_id          TEXT NOT NULL REFERENCES remedies(remedy_id) ON DELETE CASCADE,
  priority           INTEGER NOT NULL DEFAULT 0,
  rationale          TEXT,
  PRIMARY KEY (defect_id, remedy_id)
);

CREATE TABLE IF NOT EXISTS graph_nodes (
  node_id            TEXT PRIMARY KEY,
  case_id            TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
  type               node_type NOT NULL,
  ref_id             TEXT NOT NULL,
  stage              stage_code,
  label              TEXT NOT NULL,
  attributes         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS graph_edges (
  edge_id            TEXT PRIMARY KEY,
  case_id            TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
  type               edge_type NOT NULL,
  from_node_id       TEXT NOT NULL REFERENCES graph_nodes(node_id) ON DELETE CASCADE,
  to_node_id         TEXT NOT NULL REFERENCES graph_nodes(node_id) ON DELETE CASCADE,
  weight             REAL NOT NULL DEFAULT 1.0,
  attributes         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (weight >= 0)
);

CREATE INDEX IF NOT EXISTS idx_docs_case ON documents(case_id);
CREATE INDEX IF NOT EXISTS idx_excerpts_doc ON excerpts(doc_id);
CREATE INDEX IF NOT EXISTS idx_claims_case ON claims(case_id);
CREATE INDEX IF NOT EXISTS idx_decisions_case ON decisions(case_id);
CREATE INDEX IF NOT EXISTS idx_defects_case ON defects(case_id);
CREATE INDEX IF NOT EXISTS idx_nodes_case ON graph_nodes(case_id);
CREATE INDEX IF NOT EXISTS idx_edges_case ON graph_edges(case_id);
CREATE INDEX IF NOT EXISTS idx_edges_from ON graph_edges(from_node_id);
CREATE INDEX IF NOT EXISTS idx_edges_to ON graph_edges(to_node_id);

CREATE TABLE IF NOT EXISTS audit_events (
  audit_id           TEXT PRIMARY KEY,
  case_id            TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
  event_time         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor              TEXT NOT NULL,
  action             TEXT NOT NULL,
  payload            JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS rulepacks (
  rulepack_id        TEXT PRIMARY KEY,
  version            TEXT NOT NULL,
  description        TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rule_runs (
  run_id             TEXT PRIMARY KEY,
  case_id            TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
  rulepack_id        TEXT NOT NULL REFERENCES rulepacks(rulepack_id),
  started_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at        TIMESTAMPTZ,
  input_hash         TEXT,
  output_hash        TEXT,
  stats              JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS findings (
  finding_id         TEXT PRIMARY KEY,
  run_id             TEXT NOT NULL REFERENCES rule_runs(run_id) ON DELETE CASCADE,
  severity           finding_severity NOT NULL,
  title              TEXT NOT NULL,
  details            TEXT NOT NULL,
  rule_id            TEXT REFERENCES rules(rule_id),
  defect_id          TEXT REFERENCES defects(defect_id),
  node_ids           JSONB NOT NULL DEFAULT '[]'::jsonb,
  excerpt_ids        JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
