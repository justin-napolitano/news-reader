CREATE SCHEMA IF NOT EXISTS intel_graph;

CREATE TABLE IF NOT EXISTS intel_graph.import_runs (
  id TEXT PRIMARY KEY,
  importer_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  source_kind TEXT NOT NULL,
  source_id TEXT NOT NULL,
  status TEXT NOT NULL,
  counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  payload JSONB NOT NULL,
  source_hash TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS intel_graph.graph_patches (
  id TEXT PRIMARY KEY,
  patch_type TEXT NOT NULL,
  mode TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  preconditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  operations JSONB NOT NULL DEFAULT '[]'::jsonb,
  audit JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload JSONB NOT NULL,
  source_hash TEXT NOT NULL,
  import_run_id TEXT REFERENCES intel_graph.import_runs(id) ON DELETE SET NULL,
  applied_at TIMESTAMPTZ,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS intel_graph.sources (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  name TEXT NOT NULL,
  section TEXT NOT NULL DEFAULT '',
  canonical_url TEXT,
  source_url TEXT,
  feed_url TEXT,
  allow_hosts JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  rights JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  authority JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload JSONB NOT NULL,
  source_hash TEXT NOT NULL,
  import_run_id TEXT REFERENCES intel_graph.import_runs(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS intel_graph.works (
  id TEXT PRIMARY KEY,
  work_type TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  canonical_url TEXT,
  source_id TEXT NOT NULL REFERENCES intel_graph.sources(id) ON DELETE RESTRICT,
  source_name TEXT NOT NULL DEFAULT '',
  section TEXT NOT NULL DEFAULT '',
  published_at TIMESTAMPTZ,
  excerpt TEXT NOT NULL DEFAULT '',
  identifiers JSONB NOT NULL DEFAULT '[]'::jsonb,
  rights JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload JSONB NOT NULL,
  source_hash TEXT NOT NULL,
  import_run_id TEXT REFERENCES intel_graph.import_runs(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_id, url)
);

CREATE TABLE IF NOT EXISTS intel_graph.work_segments (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES intel_graph.works(id) ON DELETE CASCADE,
  segment_type TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL DEFAULT '',
  content_ref TEXT,
  selector JSONB NOT NULL DEFAULT '{}'::jsonb,
  excerpt TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL,
  source_hash TEXT NOT NULL,
  import_run_id TEXT REFERENCES intel_graph.import_runs(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (work_id, segment_type, position, content_ref)
);

CREATE TABLE IF NOT EXISTS intel_graph.intake_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  actor_id TEXT NOT NULL DEFAULT 'user:default',
  work_id TEXT REFERENCES intel_graph.works(id) ON DELETE CASCADE,
  source_id TEXT REFERENCES intel_graph.sources(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  correlation_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  payload JSONB NOT NULL,
  source_hash TEXT NOT NULL,
  import_run_id TEXT REFERENCES intel_graph.import_runs(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS intel_graph.annotations (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES intel_graph.works(id) ON DELETE CASCADE,
  segment_id TEXT REFERENCES intel_graph.work_segments(id) ON DELETE SET NULL,
  actor_id TEXT NOT NULL DEFAULT 'user:default',
  motivation TEXT NOT NULL,
  body JSONB NOT NULL DEFAULT '{}'::jsonb,
  target JSONB NOT NULL DEFAULT '{}'::jsonb,
  selector JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload JSONB NOT NULL,
  source_hash TEXT NOT NULL,
  import_run_id TEXT REFERENCES intel_graph.import_runs(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS intel_graph.entities (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  name TEXT NOT NULL,
  canonical_url TEXT,
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  identifiers JSONB NOT NULL DEFAULT '[]'::jsonb,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload JSONB NOT NULL,
  source_hash TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS intel_graph.topics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  topic_type TEXT NOT NULL DEFAULT 'emergent',
  parent_topic_id TEXT REFERENCES intel_graph.topics(id) ON DELETE SET NULL,
  description TEXT NOT NULL DEFAULT '',
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload JSONB NOT NULL,
  source_hash TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS intel_graph.claims (
  id TEXT PRIMARY KEY,
  claim_text TEXT NOT NULL,
  claim_type TEXT NOT NULL DEFAULT 'assertion',
  work_id TEXT REFERENCES intel_graph.works(id) ON DELETE SET NULL,
  segment_id TEXT REFERENCES intel_graph.work_segments(id) ON DELETE SET NULL,
  source_id TEXT REFERENCES intel_graph.sources(id) ON DELETE SET NULL,
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0,
  stance TEXT NOT NULL DEFAULT 'source_asserts',
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload JSONB NOT NULL,
  source_hash TEXT NOT NULL,
  import_run_id TEXT REFERENCES intel_graph.import_runs(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS intel_graph.work_entities (
  work_id TEXT NOT NULL REFERENCES intel_graph.works(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL REFERENCES intel_graph.entities(id) ON DELETE CASCADE,
  segment_id TEXT REFERENCES intel_graph.work_segments(id) ON DELETE SET NULL,
  relationship_type TEXT NOT NULL DEFAULT 'mentions',
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_hash TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (work_id, entity_id, relationship_type)
);

CREATE TABLE IF NOT EXISTS intel_graph.work_topics (
  work_id TEXT NOT NULL REFERENCES intel_graph.works(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL REFERENCES intel_graph.topics(id) ON DELETE CASCADE,
  segment_id TEXT REFERENCES intel_graph.work_segments(id) ON DELETE SET NULL,
  relationship_type TEXT NOT NULL DEFAULT 'about',
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_hash TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (work_id, topic_id, relationship_type)
);

CREATE TABLE IF NOT EXISTS intel_graph.source_assessments (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES intel_graph.sources(id) ON DELETE CASCADE,
  assessor_id TEXT NOT NULL DEFAULT 'user:default',
  assessment_type TEXT NOT NULL,
  score NUMERIC(5,4),
  reason_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL,
  source_hash TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_id, assessor_id, assessment_type)
);

CREATE TABLE IF NOT EXISTS intel_graph.relevance_scores (
  id TEXT PRIMARY KEY,
  subject_kind TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  algorithm_id TEXT NOT NULL,
  algorithm_version TEXT NOT NULL,
  score NUMERIC(7,6) NOT NULL,
  reason_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  tie_breaker TEXT NOT NULL,
  confidence_note TEXT NOT NULL DEFAULT '',
  mutation_policy TEXT NOT NULL DEFAULT 'advisory_only',
  payload JSONB NOT NULL,
  source_hash TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subject_kind, subject_id, algorithm_id, algorithm_version)
);

CREATE TABLE IF NOT EXISTS intel_graph.project_connections (
  id TEXT PRIMARY KEY,
  subject_kind TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  project_ref TEXT NOT NULL,
  connection_type TEXT NOT NULL,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  review_state TEXT NOT NULL DEFAULT 'needs_review',
  payload JSONB NOT NULL,
  source_hash TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subject_kind, subject_id, project_ref, connection_type)
);

CREATE TABLE IF NOT EXISTS intel_graph.life_graph_mappings (
  intel_kind TEXT NOT NULL,
  intel_id TEXT NOT NULL,
  life_graph_object_id TEXT NOT NULL REFERENCES public.life_graph_objects(id) ON DELETE CASCADE,
  mapping_status TEXT NOT NULL DEFAULT 'proposed',
  source_hash TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (intel_kind, intel_id)
);

CREATE INDEX IF NOT EXISTS idx_intel_graph_sources_life_object
  ON intel_graph.life_graph_mappings (life_graph_object_id);

CREATE INDEX IF NOT EXISTS idx_intel_graph_works_source
  ON intel_graph.works (source_id);

CREATE INDEX IF NOT EXISTS idx_intel_graph_works_published_at
  ON intel_graph.works (published_at DESC);

CREATE INDEX IF NOT EXISTS idx_intel_graph_segments_work
  ON intel_graph.work_segments (work_id, position);

CREATE INDEX IF NOT EXISTS idx_intel_graph_events_work
  ON intel_graph.intake_events (work_id, event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_intel_graph_annotations_work
  ON intel_graph.annotations (work_id);

CREATE INDEX IF NOT EXISTS idx_intel_graph_patches_import_run
  ON intel_graph.graph_patches (import_run_id);

CREATE INDEX IF NOT EXISTS idx_intel_graph_claims_work
  ON intel_graph.claims (work_id);

CREATE INDEX IF NOT EXISTS idx_intel_graph_relevance_subject
  ON intel_graph.relevance_scores (subject_kind, subject_id, score DESC);
