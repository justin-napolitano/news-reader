const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const CONTRACT_FILES = {
  annotation: "annotation.schema.json",
  claim: "claim.schema.json",
  entity: "entity.schema.json",
  graph_patch: "graph-patch.schema.json",
  import_run: "import-run.schema.json",
  intake_event: "intake-event.schema.json",
  life_graph_import: "life-graph-import.schema.json",
  life_graph_migration_manifest: "life-graph-migration-manifest.schema.json",
  project_connection: "project-connection.schema.json",
  relevance_result: "relevance-result.schema.json",
  source: "source.schema.json",
  topic: "topic.schema.json",
  work: "work.schema.json"
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadContractSchemas(root = path.resolve(__dirname, "..")) {
  const contractDir = path.join(root, "contracts");
  return Object.fromEntries(
    Object.entries(CONTRACT_FILES).map(([key, fileName]) => [key, readJson(path.join(contractDir, fileName))])
  );
}

function stableHash(parts) {
  return crypto.createHash("sha1").update(parts.filter(Boolean).join("|")).digest("hex").slice(0, 16);
}

function stableJsonStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJsonStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJsonStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function stableJsonHash(value) {
  return crypto.createHash("sha1").update(stableJsonStringify(value)).digest("hex").slice(0, 16);
}

function graphId(prefix, parts) {
  return `${prefix}:${stableHash(parts)}`;
}

function compactObject(value) {
  if (Array.isArray(value)) {
    return value.map(compactObject).filter((item) => item !== undefined);
  }

  if (!value || typeof value !== "object") {
    return value === undefined || value === null ? undefined : value;
  }

  const entries = Object.entries(value)
    .map(([key, child]) => [key, compactObject(child)])
    .filter(([_key, child]) => child !== undefined);

  return Object.fromEntries(entries);
}

function sourceConfigToGraphSource(source, evidenceRef = "data/sources.json") {
  return compactObject({
    schema_version: 1,
    kind: "source",
    id: source.id,
    source_type: "publisher",
    name: source.name,
    section: source.section || "",
    feed_url: source.feedUrl,
    allow_hosts: source.allowHosts || [],
    tags: source.section ? [source.section] : [],
    rights: {
      full_text_storage: "metadata_only",
      notes: "Reader extraction is on demand; source full text is not persisted by default."
    },
    provenance: {
      imported_from: "news-reader:data/sources.json",
      evidence_refs: [evidenceRef]
    }
  });
}

function feedItemToWork(item) {
  return compactObject({
    schema_version: 1,
    kind: "work",
    id: graphId("work", [item.url, item.title, item.sourceId]),
    work_type: "article",
    title: item.title,
    url: item.url,
    source_id: item.sourceId,
    source_name: item.source,
    section: item.section || "",
    published_at: item.publishedAt || undefined,
    excerpt: item.excerpt || "",
    identifiers: [{ type: "feed_item_id", value: item.id }],
    rights: {
      full_text_storage: "metadata_only",
      notes: "Feed metadata and excerpts may be stored; readable article text remains transient by default."
    },
    provenance: {
      source_item_id: item.id,
      evidence_refs: [`source:${item.sourceId}`, `url:${item.url}`]
    }
  });
}

function createImportRun({ importerId, sourceKind, sourceId, idempotencyKey, status, counts, errors }) {
  return compactObject({
    schema_version: 1,
    kind: "import_run",
    id: graphId("import_run", [importerId, sourceKind, sourceId, idempotencyKey]),
    importer_id: importerId,
    source: {
      kind: sourceKind,
      id: sourceId
    },
    idempotency_key: idempotencyKey,
    started_at: new Date().toISOString(),
    status,
    counts,
    errors: errors || []
  });
}

function createDryRunGraphPatch({ idempotencyKey, operations }) {
  return {
    schema_version: 1,
    kind: "graph_patch",
    id: graphId("graph_patch", [idempotencyKey]),
    patch_type: "import",
    idempotency_key: idempotencyKey,
    mode: "dry_run",
    preconditions: ["contracts_validated", "metadata_only_storage_policy"],
    operations,
    audit: {
      created: 0,
      updated: 0,
      skipped: operations.length,
      blocked: 0,
      notes: ["Dry-run patch preview only; no graph state was mutated."]
    }
  };
}

module.exports = {
  CONTRACT_FILES,
  createDryRunGraphPatch,
  createImportRun,
  feedItemToWork,
  graphId,
  loadContractSchemas,
  sourceConfigToGraphSource,
  stableHash,
  stableJsonHash,
  stableJsonStringify
};
