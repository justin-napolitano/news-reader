const { spawn } = require("child_process");

const PORT = "4185";
const BASE_URL = `http://127.0.0.1:${PORT}`;
const server = spawn(process.execPath, ["server.js"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT,
    LIFE_GRAPH_API_BASE_URL: "",
    LIFE_GRAPH_WRITE_TOKEN: "",
    NEWS_READER_ITEMS_SOURCE: "feed",
    NEWS_READER_FIXTURE: "1",
    NEWS_READER_ADMIN_PASSCODE: "fixture-pass",
    NEWS_READER_SESSION_SECRET: "fixture-session-secret",
    NEWS_READER_CRON_SECRET: "fixture-cron-secret",
    NEWS_READER_COOKIE_SECURE: "0"
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let output = "";
let sessionCookie = "";

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
  const headers = {
    ...(options.headers || {})
  };

  if (options.auth !== false && sessionCookie) {
    headers.cookie = sessionCookie;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${text}`);
  }

  return { response, text };
}

async function main() {
  await wait(500);

  const guardedHome = await fetch(`${BASE_URL}/`, { redirect: "manual" });

  if (guardedHome.status !== 303 || !guardedHome.headers.get("location")?.startsWith("/login")) {
    throw new Error("home page did not redirect unauthenticated users to login");
  }

  const guardedItems = await fetch(`${BASE_URL}/api/items`);

  if (guardedItems.status !== 401) {
    throw new Error("items API did not reject unauthenticated users");
  }

  const guardedCron = await fetch(`${BASE_URL}/api/cron/news-import`);

  if (guardedCron.status !== 401) {
    throw new Error("cron import endpoint did not reject missing bearer auth");
  }

  const blockedCron = await fetch(`${BASE_URL}/api/cron/news-import`, {
    headers: { authorization: "Bearer fixture-cron-secret" }
  });
  const blockedCronPayload = await blockedCron.json();

  if (blockedCron.status !== 503 || blockedCronPayload.blockers?.[0]?.code !== "life_graph_api_base_url_missing") {
    throw new Error("cron import endpoint did not reach Life Graph config guard after bearer auth");
  }

  const loginPage = await request("/login", { auth: false });

  if (!loginPage.text.includes("News Reader") || !loginPage.text.includes("Passcode")) {
    throw new Error("login page did not render");
  }

  const login = await fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: "admin", passcode: "fixture-pass" }),
    redirect: "manual"
  });

  if (login.status !== 303 || !login.headers.get("set-cookie")) {
    throw new Error("login did not create a session cookie");
  }

  sessionCookie = login.headers.get("set-cookie").split(";")[0];

  const home = await request("/");

  if (!home.text.includes("News Reader") || !home.text.includes("view-strip")) {
    throw new Error("home page did not render News Reader");
  }

  const reader = await request("/reader.html?url=https%3A%2F%2Fexample.com%2Fstory-one&title=Fixture&work_id=work%3Afixture-story");

  if (!reader.text.includes("Open original") || !reader.text.includes("reader-save") || !reader.text.includes("reader-archive") || !reader.text.includes("/reader.js")) {
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

  const refreshItems = await request("/api/items/refresh?view=unread", { method: "POST" });
  const refreshItemsPayload = JSON.parse(refreshItems.text);

  if (
    !Array.isArray(refreshItemsPayload.items) ||
    refreshItemsPayload.items.length !== 2 ||
    refreshItemsPayload.refresh?.mode !== "feed"
  ) {
    throw new Error("reader refresh endpoint did not return refreshed fixture items");
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

  const lifeGraphStatus = await request("/api/life-graph/status");
  const lifeGraphStatusPayload = JSON.parse(lifeGraphStatus.text);

  if (!lifeGraphStatusPayload.ok || lifeGraphStatusPayload.data?.configured !== false) {
    throw new Error("life graph status endpoint did not return safe config metadata");
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

  const applyGet = await fetch(`${BASE_URL}/api/life-graph/import/apply`, {
    headers: { cookie: sessionCookie }
  });

  if (applyGet.status !== 405) {
    throw new Error("life graph apply endpoint allowed non-POST requests");
  }

  const stateGet = await fetch(`${BASE_URL}/api/life-graph/intel/reader/state`, {
    headers: { cookie: sessionCookie }
  });

  if (stateGet.status !== 405) {
    throw new Error("life graph reader state endpoint allowed non-POST requests");
  }

  const remoteWorks = await request("/api/life-graph/intel/works");
  const remoteWorksPayload = JSON.parse(remoteWorks.text);

  if (remoteWorksPayload.ok || remoteWorksPayload.blockers?.[0]?.code !== "life_graph_api_base_url_missing") {
    throw new Error("life graph remote works endpoint should block safely when unconfigured");
  }

  const remoteReaderWorks = await request("/api/life-graph/intel/reader/works");
  const remoteReaderWorksPayload = JSON.parse(remoteReaderWorks.text);

  if (remoteReaderWorksPayload.ok || remoteReaderWorksPayload.blockers?.[0]?.code !== "life_graph_api_base_url_missing") {
    throw new Error("life graph reader works endpoint should block safely when unconfigured");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        checked: [
          "home",
          "login gate",
          "cron auth gate",
          "login form",
          "reader page",
          "sources",
          "fixture feed",
          "reader refresh",
          "graph sources",
          "graph contracts",
          "graph works",
          "idempotency",
          "life graph migrations",
          "life graph status",
          "life graph dry-run import",
          "life graph post-only mutation guard",
          "life graph reader state mutation guard",
          "life graph remote block",
          "life graph reader works block"
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
