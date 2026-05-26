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
  life_graph_object_id TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL,
  name TEXT NOT NULL,
  section TEXT NOT NULL DEFAULT '',
  source_url TEXT,
  feed_url TEXT,
  allow_hosts JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  rights JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload JSONB NOT NULL,
  source_hash TEXT NOT NULL,
  import_run_id TEXT REFERENCES intel_graph.import_runs(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS intel_graph.works (
  id TEXT PRIMARY KEY,
  life_graph_object_id TEXT NOT NULL UNIQUE,
  work_type TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS intel_graph.annotations (
  id TEXT PRIMARY KEY,
  life_graph_object_id TEXT,
  work_id TEXT NOT NULL REFERENCES intel_graph.works(id) ON DELETE CASCADE,
  motivation TEXT NOT NULL,
  body JSONB NOT NULL DEFAULT '{}'::jsonb,
  target JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload JSONB NOT NULL,
  source_hash TEXT NOT NULL,
  import_run_id TEXT REFERENCES intel_graph.import_runs(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  ON intel_graph.sources (life_graph_object_id);

CREATE INDEX IF NOT EXISTS idx_intel_graph_works_source
  ON intel_graph.works (source_id);

CREATE INDEX IF NOT EXISTS idx_intel_graph_works_life_object
  ON intel_graph.works (life_graph_object_id);

CREATE INDEX IF NOT EXISTS idx_intel_graph_works_published_at
  ON intel_graph.works (published_at DESC);

CREATE INDEX IF NOT EXISTS idx_intel_graph_annotations_work
  ON intel_graph.annotations (work_id);

CREATE INDEX IF NOT EXISTS idx_intel_graph_patches_import_run
  ON intel_graph.graph_patches (import_run_id);
