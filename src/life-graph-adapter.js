const { stableHash, stableJsonHash } = require("./intel-graph");

const LIFE_GRAPH_MIGRATIONS = [
  {
    id: "003_news_reader_intel_intake",
    file: "integrations/life-graph/migrations/003_news_reader_intel_intake.sql",
    status: "proposed",
    applies_after: ["001_life_graph_core.sql", "002_life_graph_curation_promotion.sql"]
  }
];

function slugPart(value, fallback = "item") {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug || fallback;
}

function shortSummary(value, fallback) {
  const text = String(value || fallback || "").replace(/\s+/g, " ").trim();
  if (text.length <= 280) return text;
  return `${text.slice(0, 277).trim()}...`;
}

function uniqueTags(values) {
  const seen = new Set();
  const tags = [];

  values.forEach((value) => {
    const tag = slugPart(value, "");
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      tags.push(tag);
    }
  });

  return tags;
}

function sourceObjectId(source) {
  return `intel.source.${slugPart(source.id)}`;
}

function workObjectId(work) {
  return `intel.work.${stableHash([work.url, work.title, work.source_id])}`;
}

function provenanceSourceForUrl(url, note) {
  return url
    ? { type: "other", url, note }
    : { type: "other", note };
}

function intelSourceToLifeGraphObject(source) {
  const id = sourceObjectId(source);
  const sourceHash = stableJsonHash(source);
  const tags = uniqueTags(["intel", "intel-source", source.source_type, source.section, ...(source.tags || [])]);

  return {
    id,
    type: "life_object",
    title: source.name,
    summary: shortSummary(
      `Configured intel source for ${source.section || source.source_type || "reader intake"}.`,
      "Configured intel source."
    ),
    visibility: "private",
    review_state: "curated",
    tags,
    taxonomy: {
      kind: "life_object",
      status: "active",
      audiences: ["agents"],
      domains: uniqueTags(["intel", source.section]),
      facets: {
        category: "intel_source",
        privacy_tier: "private",
        source_type: source.source_type,
        original_source_id: source.id,
        rights_policy: source.rights?.full_text_storage || "unknown"
      }
    },
    links: [
      source.source_url ? { kind: "source", href: source.source_url, label: "Source" } : null,
      source.feed_url ? { kind: "source", href: source.feed_url, label: "Feed" } : null
    ].filter(Boolean),
    relationships: [],
    provenance: {
      sources: [
        {
          type: "repo_file",
          path: "data/sources.json",
          note: `Normalized by news-reader from source id ${source.id}.`
        }
      ]
    },
    projections: [],
    payload: {
      intel_graph_kind: "source",
      intel_graph_payload: source,
      source_hash: sourceHash
    }
  };
}

function intelWorkToLifeGraphObject(work) {
  const id = workObjectId(work);
  const sourceId = sourceObjectId({ id: work.source_id });
  const sourceHash = stableJsonHash(work);
  const tags = uniqueTags(["intel", "intel-work", work.work_type, work.section, work.source_id]);

  return {
    id,
    type: "life_object",
    title: work.title,
    summary: shortSummary(work.excerpt, `Intel work from ${work.source_name || work.source_id}.`),
    visibility: "private",
    review_state: "discovered",
    tags,
    taxonomy: {
      kind: "life_object",
      status: "published",
      audiences: ["agents"],
      domains: uniqueTags(["intel", work.section, work.source_name]),
      facets: {
        category: "intel_work",
        privacy_tier: "private",
        work_type: work.work_type,
        source_id: work.source_id,
        source_object_id: sourceId,
        published_at: work.published_at || "",
        rights_policy: work.rights?.full_text_storage || "unknown"
      }
    },
    links: [{ kind: "article", href: work.url, label: "Original" }],
    relationships: [
      {
        type: "derived_from_source",
        target_id: sourceId
      }
    ],
    provenance: {
      sources: [
        provenanceSourceForUrl(work.url, `RSS/Atom metadata normalized by news-reader for source ${work.source_id}.`)
      ]
    },
    projections: [],
    payload: {
      intel_graph_kind: "work",
      intel_graph_payload: work,
      source_hash: sourceHash
    }
  };
}

function workToLifeGraphEdge(work) {
  const sourceObjectId = sourceObjectIdFromWork(work);
  const workId = workObjectId(work);
  const payload = {
    source_id: work.source_id,
    work_url: work.url,
    relationship: "work_derived_from_source"
  };

  return {
    source_object_id: workId,
    target_object_id: sourceObjectId,
    edge_type: "derived_from_source",
    payload,
    source_hash: stableJsonHash(payload)
  };
}

function sourceObjectIdFromWork(work) {
  return sourceObjectId({ id: work.source_id });
}

function createLifeGraphDryRunImport({ sources, works, importRun, graphPatch, generatedAt }) {
  const sourceObjects = sources.map(intelSourceToLifeGraphObject);
  const workObjects = works.map(intelWorkToLifeGraphObject);
  const edges = works.map(workToLifeGraphEdge);
  const objects = [...sourceObjects, ...workObjects];
  const idempotencyKey = `life-graph:intel-import:${stableJsonHash({
    object_ids: objects.map((object) => object.id).sort(),
    edges
  })}`;
  const sourceHash = stableJsonHash({ objects, edges });

  return {
    schema_version: 1,
    kind: "life_graph_import",
    id: `life_graph_import:${stableHash([idempotencyKey])}`,
    target: "jnap-life-graph",
    mode: "dry_run",
    idempotency_key: idempotencyKey,
    generated_at: generatedAt,
    source_hash: sourceHash,
    migration_refs: LIFE_GRAPH_MIGRATIONS,
    import_run: importRun,
    graph_patch: graphPatch,
    objects,
    edges,
    audit: {
      created: 0,
      updated: 0,
      skipped: objects.length + edges.length,
      blocked: 0,
      notes: [
        "Dry-run only; no Life Graph database writes were attempted.",
        "Objects are private by default and require curation before projection."
      ]
    }
  };
}

module.exports = {
  LIFE_GRAPH_MIGRATIONS,
  createLifeGraphDryRunImport,
  intelSourceToLifeGraphObject,
  intelWorkToLifeGraphObject,
  sourceObjectId,
  workObjectId
};
