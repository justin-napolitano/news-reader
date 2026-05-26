const fs = require("fs");
const path = require("path");
const { assertValid } = require("../src/contract-validator");
const {
  CONTRACT_FILES,
  createDryRunGraphPatch,
  createImportRun,
  feedItemToWork,
  loadContractSchemas,
  sourceConfigToGraphSource
} = require("../src/intel-graph");

const ROOT = path.resolve(__dirname, "..");
const FIXTURE_DIR = path.join(ROOT, "test", "fixtures", "intel-graph");
const SOURCE_PATH = path.join(ROOT, "data", "sources.json");

const FIXTURE_SCHEMA_KEYS = {
  "annotation.json": "annotation",
  "claim.json": "claim",
  "entity.json": "entity",
  "graph-patch.json": "graph_patch",
  "import-run.json": "import_run",
  "intake-event.json": "intake_event",
  "project-connection.json": "project_connection",
  "relevance-result.json": "relevance_result",
  "source.json": "source",
  "topic.json": "topic",
  "work.json": "work"
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function requireUnique(values, label) {
  const seen = new Set();
  const duplicates = new Set();

  values.forEach((value) => {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  });

  if (duplicates.size) {
    throw new Error(`${label} contains duplicate values: ${Array.from(duplicates).join(", ")}`);
  }
}

function validateSchemas(schemas) {
  const knownFiles = new Set(Object.values(CONTRACT_FILES));
  const actualFiles = new Set(fs.readdirSync(path.join(ROOT, "contracts")).filter((file) => file.endsWith(".schema.json")));

  for (const file of knownFiles) {
    if (!actualFiles.has(file)) {
      throw new Error(`Missing contract file ${file}`);
    }
  }

  for (const [key, schema] of Object.entries(schemas)) {
    if (!schema.$id || !schema.title || schema.type !== "object") {
      throw new Error(`Schema ${key} is missing $id, title, or object type`);
    }
  }
}

function validateFixtures(schemas) {
  for (const [fileName, schemaKey] of Object.entries(FIXTURE_SCHEMA_KEYS)) {
    const fixture = readJson(path.join(FIXTURE_DIR, fileName));
    assertValid(schemas[schemaKey], fixture, `fixture:${fileName}`);
  }
}

function validateConfiguredSources(schemas) {
  const payload = readJson(SOURCE_PATH);

  if (!Array.isArray(payload.sources)) {
    throw new Error("data/sources.json must contain a sources array");
  }

  requireUnique(payload.sources.map((source) => source.id), "source ids");

  payload.sources.forEach((source) => {
    if (!source.feedUrl || !Array.isArray(source.allowHosts) || !source.allowHosts.length) {
      throw new Error(`source ${source.id} must define feedUrl and allowHosts`);
    }

    assertValid(schemas.source, sourceConfigToGraphSource(source), `source:${source.id}`);
  });
}

function validateGeneratedObjects(schemas) {
  const fixtureItem = {
    id: "fixture-story-one",
    sourceId: "fixture-news",
    source: "Fixture News",
    section: "Test",
    title: "Fixture story one",
    url: "https://example.com/story-one",
    publishedAt: "2026-05-26T12:00:00.000Z",
    excerpt: "A short but useful fixture summary for the first story."
  };
  const work = feedItemToWork(fixtureItem);
  const patch = createDryRunGraphPatch({
    idempotencyKey: "fixture-generated",
    operations: [
      {
        op: "upsert",
        object_kind: "work",
        object_id: work.id,
        payload: work
      }
    ]
  });
  const run = createImportRun({
    importerId: "news-reader.fixture",
    sourceKind: "source",
    sourceId: "fixture-news",
    idempotencyKey: "fixture-generated",
    status: "completed",
    counts: {
      seen: 1,
      created: 0,
      updated: 0,
      skipped: 1,
      blocked: 0
    },
    errors: []
  });

  assertValid(schemas.work, work, "generated:work");
  assertValid(schemas.graph_patch, patch, "generated:graph_patch");
  assertValid(schemas.import_run, run, "generated:import_run");
}

function main() {
  const schemas = loadContractSchemas(ROOT);

  validateSchemas(schemas);
  validateFixtures(schemas);
  validateConfiguredSources(schemas);
  validateGeneratedObjects(schemas);

  console.log(
    JSON.stringify(
      {
        ok: true,
        checked: ["schemas", "fixtures", "configured sources", "generated objects"],
        schema_count: Object.keys(schemas).length
      },
      null,
      2
    )
  );
}

main();
