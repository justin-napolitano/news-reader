const { spawn } = require("child_process");

const PORT = "4185";
const BASE_URL = `http://127.0.0.1:${PORT}`;
const server = spawn(process.execPath, ["server.js"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT,
    NEWS_READER_FIXTURE: "1"
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let output = "";

server.stdout.on("data", (chunk) => {
  output += chunk.toString();
});

server.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${text}`);
  }

  return { response, text };
}

async function main() {
  await wait(500);

  const home = await request("/");

  if (!home.text.includes("News Reader")) {
    throw new Error("home page did not render News Reader");
  }

  const reader = await request("/reader.html?url=https%3A%2F%2Fexample.com%2Fstory-one&title=Fixture");

  if (!reader.text.includes("Open original") || !reader.text.includes("/reader.js")) {
    throw new Error("reader page did not render the article reader shell");
  }

  const sources = await request("/api/sources");
  const sourcePayload = JSON.parse(sources.text);

  if (!Array.isArray(sourcePayload.sources) || sourcePayload.sources.length < 1) {
    throw new Error("sources endpoint returned no sources");
  }

  const items = await request("/api/items");
  const itemPayload = JSON.parse(items.text);

  if (!Array.isArray(itemPayload.items) || itemPayload.items.length !== 2) {
    throw new Error("fixture feed did not return two items");
  }

  const graphSources = await request("/api/graph/sources");
  const graphSourcePayload = JSON.parse(graphSources.text);

  if (!Array.isArray(graphSourcePayload.sources) || graphSourcePayload.sources.some((source) => source.kind !== "source")) {
    throw new Error("graph sources endpoint returned invalid source objects");
  }

  const graphContracts = await request("/api/graph/contracts");
  const graphContractPayload = JSON.parse(graphContracts.text);

  if (!Array.isArray(graphContractPayload.contracts) || graphContractPayload.contracts.length < 11) {
    throw new Error("graph contracts endpoint did not return the expected contracts");
  }

  const graphWorks = await request("/api/graph/works");
  const graphWorkPayload = JSON.parse(graphWorks.text);

  if (!Array.isArray(graphWorkPayload.works) || graphWorkPayload.works.length !== 2) {
    throw new Error("graph works endpoint did not return normalized fixture works");
  }

  if (graphWorkPayload.import_run?.kind !== "import_run" || graphWorkPayload.dry_run_patch?.kind !== "graph_patch") {
    throw new Error("graph works endpoint did not return import_run and dry_run_patch metadata");
  }

  if (graphWorkPayload.works.some((work) => work.rights?.full_text_storage !== "metadata_only")) {
    throw new Error("graph works endpoint violated metadata-only storage policy");
  }

  const secondGraphWorks = await request("/api/graph/works");
  const secondGraphWorkPayload = JSON.parse(secondGraphWorks.text);

  if (secondGraphWorkPayload.import_run?.idempotency_key !== graphWorkPayload.import_run?.idempotency_key) {
    throw new Error("graph works endpoint returned unstable idempotency keys for the same fixture payload");
  }

  const lifeGraphMigrations = await request("/api/life-graph/migrations");
  const lifeGraphMigrationPayload = JSON.parse(lifeGraphMigrations.text);

  if (!lifeGraphMigrationPayload.ok || lifeGraphMigrationPayload.data?.manifest?.target !== "jnap-life-graph") {
    throw new Error("life graph migration endpoint did not return the expected manifest");
  }

  if (lifeGraphMigrationPayload.data?.schema_plan?.schema_name !== "intel_graph") {
    throw new Error("life graph migration endpoint did not return the intel schema plan");
  }

  const lifeGraphDryRun = await request("/api/life-graph/import/dry-run", { method: "POST" });
  const lifeGraphDryRunPayload = JSON.parse(lifeGraphDryRun.text);

  if (!lifeGraphDryRunPayload.ok || lifeGraphDryRunPayload.data?.kind !== "life_graph_import") {
    throw new Error("life graph dry-run endpoint did not return a life_graph_import payload");
  }

  if (lifeGraphDryRunPayload.data.mode !== "dry_run" || lifeGraphDryRunPayload.data.audit?.created !== 0) {
    throw new Error("life graph dry-run endpoint attempted non-dry-run semantics");
  }

  if (!lifeGraphDryRunPayload.data.objects?.some((object) => object.type === "life_object")) {
    throw new Error("life graph dry-run endpoint did not produce Life Graph objects");
  }

  const secondLifeGraphDryRun = await request("/api/life-graph/import/dry-run", { method: "POST" });
  const secondLifeGraphDryRunPayload = JSON.parse(secondLifeGraphDryRun.text);

  if (secondLifeGraphDryRunPayload.data?.idempotency_key !== lifeGraphDryRunPayload.data?.idempotency_key) {
    throw new Error("life graph dry-run endpoint returned unstable idempotency keys");
  }

  if (secondLifeGraphDryRunPayload.data?.source_hash !== lifeGraphDryRunPayload.data?.source_hash) {
    throw new Error("life graph dry-run endpoint returned unstable source hashes");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        checked: [
          "home",
          "reader page",
          "sources",
          "fixture feed",
          "graph sources",
          "graph contracts",
          "graph works",
          "idempotency",
          "life graph migrations",
          "life graph dry-run import"
        ]
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(output);
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    server.kill();
  });
