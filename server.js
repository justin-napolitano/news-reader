const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { URL } = require("url");
const {
  CONTRACT_FILES,
  createDryRunGraphPatch,
  createImportRun,
  feedItemToWork,
  loadContractSchemas,
  sourceConfigToGraphSource,
  stableHash
} = require("./src/intel-graph");
const { createLifeGraphDryRunImport } = require("./src/life-graph-adapter");
const {
  applyLifeGraphExtractions,
  applyLifeGraphRetention,
  getLifeGraphLatestNewsReaderImport,
  getLifeGraphReaderPreferences,
  intelSourceToReaderSource,
  intelWorkToReaderItem,
  lifeGraphConfig,
  lifeGraphConfigStatus,
  listLifeGraphIntelSources,
  listLifeGraphIntelWorks,
  listLifeGraphReaderWorks,
  remoteData,
  reviewLifeGraphExtractions,
  sendNewsReaderImport,
  setLifeGraphIntelSourceEnabled,
  upsertLifeGraphIntelSource,
  upsertLifeGraphReaderNote,
  upsertLifeGraphReaderPreferences,
  updateLifeGraphReaderState
} = require("./src/life-graph-client");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const SOURCE_PATH = path.join(ROOT, "data", "sources.json");
const PORT = Number.parseInt(process.env.PORT || "4175", 10);
const HOST = process.env.HOST || "127.0.0.1";
const FEED_TTL_MS = 10 * 60 * 1000;
const READ_TTL_MS = 20 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12000;
const USER_AGENT = "NewsReader/0.1 (+local personal reader)";
const SESSION_COOKIE = "news_reader_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

let feedCache = { fetchedAt: 0, payload: null };
let refreshStatus = {
  last_attempt_at: "",
  last_success_at: "",
  ok: null,
  mode: "",
  item_count: 0,
  source: "",
  remote_counts: null,
  blockers: []
};
const readCache = new Map();

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(body);
}

function apiResponse(command, data, { blockers = [], provenance = [], next_actions = [], status = "ok" } = {}) {
  return {
    ok: blockers.length === 0 && status === "ok",
    status: blockers.length ? "blocked" : status,
    command,
    blockers,
    data,
    provenance,
    next_actions
  };
}

function sendText(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "content-type": contentType,
    "cache-control": "no-store"
  });
  res.end(body);
}

function sendHtml(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    ...extraHeaders
  });
  res.end(body);
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > 1024 * 1024) {
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      resolve(body);
    });
    req.on("error", reject);
  });
}

async function readJsonBody(req) {
  const body = await readRequestBody(req);

  if (!body.trim()) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch (_err) {
    return {};
  }
}

async function readFormBody(req) {
  const body = await readRequestBody(req);
  return Object.fromEntries(new URLSearchParams(body));
}

function authConfig() {
  const passcode = String(process.env.NEWS_READER_ADMIN_PASSCODE || "");
  const required = process.env.NEWS_READER_AUTH_REQUIRED !== "0";

  return {
    adminUser: String(process.env.NEWS_READER_ADMIN_USER || "admin"),
    cookieSecure:
      process.env.NEWS_READER_COOKIE_SECURE === "1" ||
      Boolean(process.env.VERCEL) ||
      process.env.NODE_ENV === "production",
    passcode,
    required,
    sessionSecret: String(process.env.NEWS_READER_SESSION_SECRET || passcode)
  };
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return index === -1
          ? [part, ""]
          : [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function constantTimeEqual(left, right) {
  const leftHash = crypto.createHash("sha256").update(String(left)).digest();
  const rightHash = crypto.createHash("sha256").update(String(right)).digest();

  return crypto.timingSafeEqual(leftHash, rightHash);
}

function signSession(payload, secret) {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");

  return `${encodedPayload}.${signature}`;
}

function verifySession(token, secret) {
  if (!token || !secret || !token.includes(".")) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");
  const expected = crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");

  if (!constantTimeEqual(signature, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));

    if (!payload.exp || Number(payload.exp) < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch (_err) {
    return null;
  }
}

function sessionCookie(value, config) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL_SECONDS}`
  ];

  if (config.cookieSecure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function clearSessionCookie(config) {
  return sessionCookie("", config).replace(`Max-Age=${SESSION_TTL_SECONDS}`, "Max-Age=0");
}

function isAuthorized(req) {
  const config = authConfig();

  if (!config.required) {
    return true;
  }

  const cookies = parseCookies(req.headers.cookie || "");
  const payload = verifySession(cookies[SESSION_COOKIE], config.sessionSecret);

  return payload?.sub === config.adminUser;
}

function cronSecret() {
  return String(process.env.NEWS_READER_CRON_SECRET || process.env.CRON_SECRET || "");
}

function cronAuthBlockers(req) {
  const secret = cronSecret();
  const authHeader = String(req.headers.authorization || "");
  const prefix = "Bearer ";

  if (!secret) {
    return [
      {
        code: "news_reader_cron_secret_missing",
        message: "Set NEWS_READER_CRON_SECRET before enabling scheduled imports."
      }
    ];
  }

  if (!authHeader.startsWith(prefix) || !constantTimeEqual(authHeader.slice(prefix.length).trim(), secret)) {
    return [
      {
        code: "news_reader_cron_auth_invalid",
        message: "Scheduled import requires a valid bearer token."
      }
    ];
  }

  return [];
}

function blockerHttpStatus(blockers) {
  const codes = new Set((blockers || []).map((blocker) => String(blocker.code || "")));

  if (codes.has("news_reader_cron_auth_invalid")) {
    return 401;
  }

  if (
    codes.has("news_reader_source_id_required") ||
    codes.has("news_reader_source_name_required") ||
    codes.has("news_reader_source_feed_url_required") ||
    codes.has("news_reader_source_feed_url_invalid") ||
    codes.has("news_reader_source_allow_hosts_invalid") ||
    codes.has("news_reader_cron_secret_missing") ||
    codes.has("life_graph_api_base_url_missing") ||
    codes.has("life_graph_write_token_missing")
  ) {
    return codes.has("news_reader_cron_secret_missing") ||
      codes.has("life_graph_api_base_url_missing") ||
      codes.has("life_graph_write_token_missing")
      ? 503
      : 400;
  }

  return blockers?.length ? 502 : 200;
}

function wantsJson(req, pathname) {
  return pathname.startsWith("/api/") || String(req.headers.accept || "").includes("application/json");
}

function redirect(res, location, headers = {}) {
  res.writeHead(303, {
    location,
    "cache-control": "no-store",
    ...headers
  });
  res.end();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function handleUnauthorized(req, res, pathname) {
  if (wantsJson(req, pathname)) {
    sendJson(res, 401, {
      ok: false,
      status: "blocked",
      blockers: [{ code: "news_reader_auth_required", message: "Log in as admin before using News Reader." }]
    });
    return;
  }

  redirect(res, `/login?next=${encodeURIComponent(pathname || "/")}`);
}

function loginPage({ error = "", configured = true, next = "/" } = {}) {
  const config = authConfig();
  const message = configured
    ? "Enter the admin passcode."
    : "Set NEWS_READER_ADMIN_PASSCODE before exposing this reader.";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#047857" />
    <title>News Reader Login</title>
    <style>
      :root { color-scheme: light; --paper: #f7f7f2; --ink: #11110f; --muted: #62625c; --line: #d8d6cf; --accent: #047857; --error: #9f1239; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      * { box-sizing: border-box; }
      body { min-height: 100svh; margin: 0; display: grid; place-items: center; padding: 18px; color: var(--ink); background: var(--accent); text-rendering: geometricPrecision; }
      main { width: min(100%, 420px); padding: 28px; background: var(--paper); border: 1px solid var(--line); border-radius: 8px; }
      p, h1 { margin-top: 0; }
      h1 { margin-bottom: 10px; font-size: clamp(38px, 12vw, 72px); line-height: 0.92; font-weight: 520; letter-spacing: 0; }
      p { color: var(--muted); font-size: 0.92rem; line-height: 1.4; }
      form { display: grid; gap: 12px; margin-top: 24px; }
      label { display: grid; gap: 7px; color: var(--muted); font-size: 0.76rem; font-weight: 800; text-transform: uppercase; }
      input { min-height: 44px; width: 100%; padding: 0 12px; color: var(--ink); background: #fff; border: 1px solid var(--line); border-radius: 6px; font: inherit; }
      button { min-height: 44px; color: var(--paper); background: var(--ink); border: 1px solid var(--ink); border-radius: 6px; font: inherit; font-size: 0.86rem; font-weight: 800; cursor: pointer; }
      .error { color: var(--error); font-weight: 750; }
    </style>
  </head>
  <body>
    <main>
      <h1>News Reader</h1>
      <p>${escapeHtml(message)}</p>
      ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
      <form method="post" action="/login?next=${encodeURIComponent(safeNext)}">
        <label>
          Login
          <input name="username" value="${escapeHtml(config.adminUser)}" autocomplete="username" />
        </label>
        <label>
          Passcode
          <input name="passcode" type="password" autocomplete="current-password" autofocus />
        </label>
        <button type="submit">Enter</button>
      </form>
    </main>
  </body>
</html>`;
}

async function handleLogin(req, res, requestUrl) {
  const config = authConfig();
  const next = requestUrl.searchParams.get("next") || "/";

  if (req.method === "GET") {
    sendHtml(res, 200, loginPage({ configured: Boolean(config.passcode), next }));
    return;
  }

  if (req.method !== "POST") {
    sendText(res, 405, "Method not allowed");
    return;
  }

  if (!config.passcode) {
    sendHtml(res, 503, loginPage({ configured: false, next }));
    return;
  }

  const body = await readFormBody(req);
  const username = String(body.username || "").trim();
  const passcode = String(body.passcode || "");

  if (!constantTimeEqual(username, config.adminUser) || !constantTimeEqual(passcode, config.passcode)) {
    sendHtml(res, 401, loginPage({ error: "Invalid login.", configured: true, next }));
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const token = signSession({ sub: config.adminUser, iat: now, exp: now + SESSION_TTL_SECONDS }, config.sessionSecret);

  redirect(res, next.startsWith("/") && !next.startsWith("//") ? next : "/", {
    "set-cookie": sessionCookie(token, config)
  });
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function decodeEntities(value) {
  const entities = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " "
  };

  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-zA-Z]+);/g, (match, key) => entities[key] || match);
}

function stripHtml(value) {
  return normalizeWhitespace(
    decodeEntities(value)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  );
}

function getTag(block, names) {
  for (const name of names) {
    const pattern = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i");
    const match = block.match(pattern);

    if (match) {
      return decodeEntities(match[1]).trim();
    }
  }

  return "";
}

function getAttr(block, tagName, attrName) {
  const pattern = new RegExp(`<${tagName}\\b([^>]*)>`, "gi");
  let match;

  while ((match = pattern.exec(block))) {
    const attrs = match[1];
    const attr = attrs.match(new RegExp(`${attrName}=["']([^"']+)["']`, "i"));

    if (attr) {
      return decodeEntities(attr[1]).trim();
    }
  }

  return "";
}

function hashId(value) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 16);
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseFeed(xml, source) {
  const isAtom = /<feed[\s>]/i.test(xml);
  const entryPattern = isAtom ? /<entry\b[\s\S]*?<\/entry>/gi : /<item\b[\s\S]*?<\/item>/gi;
  const blocks = xml.match(entryPattern) || [];

  return blocks.slice(0, 40).map((block) => {
    const title = stripHtml(getTag(block, ["title"])) || "Untitled";
    const rssLink = getTag(block, ["link"]);
    const atomLink = getAttr(block, "link", "href");
    const url = rssLink || atomLink;
    const publishedAt = parseDate(getTag(block, ["pubDate", "published", "updated", "dc:date"]));
    const summaryHtml = getTag(block, ["description", "summary", "content", "content:encoded"]);
    const excerpt = stripHtml(summaryHtml).slice(0, 520);

    return {
      id: hashId(`${source.id}:${url}:${title}`),
      sourceId: source.id,
      source: source.name,
      section: source.section,
      title,
      url,
      publishedAt,
      excerpt
    };
  }).filter((item) => item.url && item.title);
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml,application/xml,text/xml;q=0.9,*/*;q=0.8"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function loadSources() {
  if (process.env.NEWS_READER_FIXTURE === "1") {
    return [fixtureSource()];
  }

  return readJson(SOURCE_PATH).sources;
}

function graphSourcesPayload() {
  const sources = loadSources().map((source) => sourceConfigToGraphSource(source));

  return {
    ok: true,
    schema_version: 1,
    generatedAt: new Date().toISOString(),
    itemCount: sources.length,
    sources
  };
}

function graphContractsPayload() {
  const schemas = loadContractSchemas(ROOT);
  const contracts = Object.entries(CONTRACT_FILES).map(([key, fileName]) => ({
    key,
    file: `contracts/${fileName}`,
    id: schemas[key].$id,
    title: schemas[key].title
  }));

  return {
    ok: true,
    schema_version: 1,
    generatedAt: new Date().toISOString(),
    itemCount: contracts.length,
    contracts
  };
}

function lifeGraphMigrationsPayload() {
  const manifest = readJson(path.join(ROOT, "integrations", "life-graph", "migration-manifest.json"));
  const schemaPlan = readJson(path.join(ROOT, "integrations", "life-graph", "intel-schema.json"));

  return apiResponse("life_graph_migrations", { manifest, schema_plan: schemaPlan }, {
    provenance: [
      { type: "repo_local", source: "integrations/life-graph/migration-manifest.json" },
      { type: "repo_local", source: "integrations/life-graph/intel-schema.json" },
      { type: "repo_local", source: "integrations/life-graph/migrations/003_news_reader_intel_intake.sql" }
    ],
    next_actions: [
      {
        action: "review_migration",
        description: "Review the proposed migration before copying or vendoring it into jnap-life-graph."
      }
    ]
  });
}

function lifeGraphStatusPayload() {
  return apiResponse("life_graph_status", lifeGraphConfigStatus(), {
    provenance: [{ type: "env", source: "LIFE_GRAPH_API_BASE_URL/LIFE_GRAPH_WRITE_TOKEN/NEWS_READER_ITEMS_SOURCE" }]
  });
}

async function graphWorksPayload({ refresh = false } = {}) {
  const feedPayload = await loadItems({ refresh });
  const works = feedPayload.items.map(feedItemToWork);
  const idempotencyKey = `feed-index:${stableHash(works.map((work) => work.id))}`;

  return {
    ok: true,
    schema_version: 1,
    generatedAt: feedPayload.generatedAt,
    itemCount: works.length,
    errors: feedPayload.errors,
    import_run: createImportRun({
      importerId: "news-reader.feed-index",
      sourceKind: "feed",
      sourceId: "configured-sources",
      idempotencyKey,
      status: feedPayload.errors.length ? "completed_with_errors" : "completed",
      counts: {
        seen: feedPayload.items.length,
        created: 0,
        updated: 0,
        skipped: feedPayload.items.length,
        blocked: 0
      },
      errors: feedPayload.errors.map((item) => ({
        code: "feed_source_error",
        message: item.message,
        source_ref: item.source
      }))
    }),
    dry_run_patch: createDryRunGraphPatch({
      idempotencyKey,
      operations: works.map((work) => ({
        op: "upsert",
        object_kind: "work",
        object_id: work.id,
        payload: work
      }))
    }),
    works
  };
}

async function lifeGraphImportDryRunPayload({ refresh = false } = {}) {
  const feedPayload = await loadItems({ refresh });
  const sources = loadSources().map((source) => sourceConfigToGraphSource(source));
  const works = feedPayload.items.map(feedItemToWork);
  const idempotencyKey = `feed-index:${stableHash(works.map((work) => work.id))}`;
  const importRun = createImportRun({
    importerId: "news-reader.feed-index",
    sourceKind: "feed",
    sourceId: "configured-sources",
    idempotencyKey,
    status: feedPayload.errors.length ? "completed_with_errors" : "completed",
    counts: {
      seen: feedPayload.items.length,
      created: 0,
      updated: 0,
      skipped: feedPayload.items.length,
      blocked: 0
    },
    errors: feedPayload.errors.map((item) => ({
      code: "feed_source_error",
      message: item.message,
      source_ref: item.source
    }))
  });
  const graphPatch = createDryRunGraphPatch({
    idempotencyKey,
    operations: works.map((work) => ({
      op: "upsert",
      object_kind: "work",
      object_id: work.id,
      payload: work
    }))
  });
  const lifeGraphImport = createLifeGraphDryRunImport({
    sources,
    works,
    importRun,
    graphPatch,
    generatedAt: feedPayload.generatedAt
  });

  return apiResponse("life_graph_import_dry_run", lifeGraphImport, {
    provenance: [
      { type: "repo_local", source: "data/sources.json" },
      { type: "repo_local", source: "contracts/life-graph-import.schema.json" },
      { type: "repo_local", source: "integrations/life-graph/migration-manifest.json" },
      { type: "repo_local", source: "jnap-life-graph:schemas/life-graph-object.schema.json" }
    ],
    next_actions: [
      {
        action: "review_migration",
        description: "Review the proposed Life Graph migration before applying it in jnap-life-graph."
      },
      {
        action: "build_apply_mode",
        description: "Add an authenticated apply endpoint only after migration review and write-token handling."
      }
    ]
  });
}

async function pushLifeGraphImportPayload({ refresh = false, apply = false } = {}) {
  const localDryRun = await lifeGraphImportDryRunPayload({ refresh });

  if (!localDryRun.ok) {
    return localDryRun;
  }

  const remote = await sendNewsReaderImport(localDryRun.data, { apply });
  const blockers = remote.blockers || [];

  return apiResponse(`life_graph_import_${apply ? "apply" : "remote_dry_run"}`, {
    applied: apply && remote.ok,
    local_import: {
      id: localDryRun.data.id,
      idempotency_key: localDryRun.data.idempotency_key,
      source_hash: localDryRun.data.source_hash,
      object_count: localDryRun.data.objects.length,
      edge_count: localDryRun.data.edges.length
    },
    remote: remote.response
  }, {
    blockers,
    provenance: [
      { type: "repo_local", source: "data/sources.json" },
      { type: "news_reader", source: "POST /api/life-graph/import/dry-run" },
      { type: "life_graph_api", source: `/api/intel/imports/news-reader/${apply ? "apply" : "dry-run"}` }
    ],
    next_actions: remote.ok
      ? [
          {
            action: "list_life_graph_works",
            path: "/api/life-graph/intel/works",
            description: "Verify imported works are readable through Life Graph."
          }
        ]
      : []
  });
}

async function scheduledNewsImportPayload({ refresh = true, apply = true } = {}) {
  const attemptedAt = new Date().toISOString();
  const importPayload = await pushLifeGraphImportPayload({ refresh, apply });
  const data = importPayload.data || {};
  const remotePayload = remoteData(data.remote);
  const payload = apiResponse("cron.news_import", {
    applied: Boolean(apply && importPayload.ok && data.applied),
    dry_run: !apply,
    generated_at: new Date().toISOString(),
    local_import: data.local_import || null,
    remote_counts: remotePayload.counts || null,
    remote_command: data.remote?.command || null,
    remote_status: data.remote?.status || null
  }, {
    blockers: importPayload.blockers || [],
    provenance: [
      { type: "repo_local", source: "data/sources.json" },
      { type: "news_reader", source: "GET /api/cron/news-import" },
      { type: "life_graph_api", source: `/api/intel/imports/news-reader/${apply ? "apply" : "dry-run"}` }
    ],
    next_actions: importPayload.next_actions || []
  });

  refreshStatus = {
    last_attempt_at: attemptedAt,
    last_success_at: payload.ok ? payload.data.generated_at : refreshStatus.last_success_at,
    ok: payload.ok,
    mode: apply ? "life_graph_apply" : "life_graph_dry_run",
    item_count: data.local_import?.object_count || 0,
    source: "cron.news_import",
    remote_counts: remotePayload.counts || null,
    blockers: payload.blockers || []
  };

  return payload;
}

async function lifeGraphIntelSourcesPayload() {
  const remote = await listLifeGraphIntelSources({ limit: 500 });
  const data = remoteData(remote.response);
  const sources = Array.isArray(data.sources) ? data.sources : [];

  return apiResponse("life_graph_intel_sources", {
    sources,
    reader_sources: sources.map(intelSourceToReaderSource),
    count: sources.length,
    remote: remote.response
  }, {
    blockers: remote.blockers || [],
    provenance: [{ type: "life_graph_api", source: "/api/intel/sources" }]
  });
}

function readerSourceFromLifeGraphSource(source) {
  const readerSource = intelSourceToReaderSource(source);
  const payload = source.payload && typeof source.payload === "object" ? source.payload : {};

  return {
    ...readerSource,
    sourceType: source.source_type || "publisher",
    canonicalUrl: source.canonical_url || source.source_url || "",
    sourceUrl: source.source_url || source.canonical_url || "",
    tags: Array.isArray(source.tags) ? source.tags : [],
    isEnabled: payload.is_enabled !== false,
    updatedAt: source.updated_at || "",
    sourceHash: source.source_hash || ""
  };
}

function normalizeSourceId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeFeedUrl(value) {
  try {
    const parsed = new URL(String(value || "").trim());

    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";

    return parsed.toString();
  } catch (_err) {
    return String(value || "").trim();
  }
}

function adminSourceFeedUrl(source) {
  return normalizeFeedUrl(source.feedUrl || source.feed_url || "");
}

function listFromInput(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeAdminSourceInput(input) {
  const sourceInput = input && typeof input.source === "object" ? input.source : input || {};
  const name = String(sourceInput.name || "").trim();
  const id = normalizeSourceId(sourceInput.id || sourceInput.sourceId || name);
  const feedUrl = String(sourceInput.feedUrl || sourceInput.feed_url || "").trim();
  const canonicalUrl = String(sourceInput.canonicalUrl || sourceInput.canonical_url || sourceInput.sourceUrl || sourceInput.source_url || "").trim();
  const sourceUrl = String(sourceInput.sourceUrl || sourceInput.source_url || canonicalUrl || "").trim();
  const allowHosts = listFromInput(sourceInput.allowHosts || sourceInput.allow_hosts);
  const tags = listFromInput(sourceInput.tags);
  const blockers = [];

  if (!id) {
    blockers.push({ code: "news_reader_source_id_required", message: "Source id is required." });
  }
  if (!name) {
    blockers.push({ code: "news_reader_source_name_required", message: "Source name is required." });
  }
  if (!feedUrl) {
    blockers.push({ code: "news_reader_source_feed_url_required", message: "Feed URL is required." });
  } else {
    try {
      const parsed = new URL(feedUrl);

      if (!["http:", "https:"].includes(parsed.protocol)) {
        blockers.push({ code: "news_reader_source_feed_url_invalid", message: "Feed URL must use http or https." });
      } else if (!allowHosts.length) {
        allowHosts.push(parsed.hostname);
      }
    } catch (_err) {
      blockers.push({ code: "news_reader_source_feed_url_invalid", message: "Feed URL must be a valid URL." });
    }
  }

  if (sourceInput.allowHosts && !Array.isArray(sourceInput.allowHosts) && typeof sourceInput.allowHosts !== "string") {
    blockers.push({ code: "news_reader_source_allow_hosts_invalid", message: "Allow hosts must be a comma-separated string or list." });
  }

  return {
    ok: blockers.length === 0,
    source: {
      id,
      source_type: "publisher",
      name,
      section: String(sourceInput.section || "").trim(),
      canonical_url: canonicalUrl,
      source_url: sourceUrl,
      feed_url: feedUrl,
      allow_hosts: allowHosts,
      tags,
      rights: { full_text_storage: "metadata_only" },
      provenance: {
        sources: [{ type: "news_reader_admin", source: "admin source panel" }]
      },
      is_enabled: sourceInput.isEnabled !== false && sourceInput.is_enabled !== false
    },
    blockers
  };
}

async function adminSourcesPayload() {
  const remote = await listLifeGraphIntelSources({ limit: 500, includeDisabled: true });
  const data = remoteData(remote.response);
  const sources = Array.isArray(data.sources) ? data.sources.map(readerSourceFromLifeGraphSource) : [];

  return apiResponse("news_reader_admin_sources", {
    sources: sources.length
      ? sources
      : loadSources().map((source) => ({ ...source, isEnabled: true, sourceType: "publisher" })),
    count: sources.length,
    source: sources.length ? "life_graph" : "feed_fallback",
    config: lifeGraphConfigStatus(),
    remote: remote.response
  }, {
    blockers: remote.blockers || [],
    provenance: [
      { type: "life_graph_api", source: "/api/intel/sources?include_disabled=1" },
      { type: "repo_local", source: "data/sources.json" }
    ]
  });
}

async function upsertAdminSourcePayload(body) {
  const normalized = normalizeAdminSourceInput(body);

  if (!normalized.ok) {
    return apiResponse("news_reader_admin_source_upsert", { source: normalized.source }, { blockers: normalized.blockers });
  }

  const requestedId = normalized.source.id;
  const existingSources = await adminSourcesPayload();
  const existingSource = (existingSources.data?.sources || []).find(
    (source) => adminSourceFeedUrl(source) === normalizeFeedUrl(normalized.source.feed_url)
  );

  if (existingSource) {
    normalized.source.id = existingSource.id;
    normalized.source.provenance.sources.push({
      type: "news_reader_admin",
      source: `matched existing feed URL; requested id ${requestedId || "auto"}`
    });
  }

  const remote = await upsertLifeGraphIntelSource({ source: normalized.source });
  const data = remoteData(remote.response);

  return apiResponse("news_reader_admin_source_upsert", {
    source: data.source ? readerSourceFromLifeGraphSource(data.source) : normalized.source,
    idempotency: {
      matched_existing_feed_url: Boolean(existingSource),
      requested_id: requestedId,
      effective_id: normalized.source.id,
      restored: Boolean(existingSource && existingSource.isEnabled === false && normalized.source.is_enabled !== false)
    },
    remote: remote.response
  }, {
    blockers: [...(existingSources.blockers || []), ...(remote.blockers || [])],
    provenance: [
      { type: "news_reader_admin", source: "/api/admin/sources" },
      { type: "life_graph_api", source: "/api/intel/sources" }
    ],
    next_actions: remote.ok
      ? [
          {
            action: "refresh_news_import",
            path: "/api/items/refresh",
            reason: "A newly added source needs a feed refresh before its articles appear."
          }
        ]
      : []
  });
}

async function setAdminSourceStatePayload(body) {
  const sourceId = String(body.source_id || body.sourceId || body.id || "").trim();

  if (!sourceId) {
    return apiResponse("news_reader_admin_source_state", null, {
      blockers: [{ code: "news_reader_source_id_required", message: "Source id is required." }]
    });
  }

  const remote = await setLifeGraphIntelSourceEnabled({
    sourceId,
    enabled: body.enabled !== false
  });
  const data = remoteData(remote.response);

  return apiResponse("news_reader_admin_source_state", {
    source: data.source ? readerSourceFromLifeGraphSource(data.source) : null,
    remote: remote.response
  }, {
    blockers: remote.blockers || [],
    provenance: [
      { type: "news_reader_admin", source: "/api/admin/sources/state" },
      { type: "life_graph_api", source: "/api/intel/sources/{source_id}/state" }
    ]
  });
}

async function fetchSourceFeedText(source) {
  if (process.env.NEWS_READER_FIXTURE === "1" && String(source.feedUrl || "").startsWith("fixture://")) {
    return fs.readFileSync(path.join(ROOT, "test", "fixtures", "feed.xml"), "utf8");
  }

  return fetchText(source.feedUrl);
}

async function checkSourceHealth(source) {
  const checkedAt = new Date().toISOString();
  const startedAt = Date.now();
  const feedUrl = source.feedUrl || source.feed_url || "";

  if (source.isEnabled === false) {
    return {
      id: source.id,
      name: source.name,
      feedUrl,
      ok: true,
      status: "disabled",
      itemCount: 0,
      checkedAt,
      responseMs: 0,
      message: "Source is disabled."
    };
  }

  if (!feedUrl) {
    return {
      id: source.id,
      name: source.name,
      feedUrl,
      ok: false,
      status: "blocked",
      itemCount: 0,
      checkedAt,
      responseMs: 0,
      message: "Source has no feed URL."
    };
  }

  try {
    const xml = await fetchSourceFeedText({ ...source, feedUrl });
    const items = parseFeed(xml, { ...source, feedUrl });

    return {
      id: source.id,
      name: source.name,
      feedUrl,
      ok: items.length > 0,
      status: items.length > 0 ? "ok" : "empty",
      itemCount: items.length,
      checkedAt,
      responseMs: Date.now() - startedAt,
      message: items.length > 0 ? "" : "Feed returned no readable items."
    };
  } catch (err) {
    return {
      id: source.id,
      name: source.name,
      feedUrl,
      ok: false,
      status: "error",
      itemCount: 0,
      checkedAt,
      responseMs: Date.now() - startedAt,
      message: err instanceof Error ? err.message : String(err)
    };
  }
}

async function adminSourceHealthPayload() {
  const sourcePayload = await readerSourcesPayload();
  const sources = Array.isArray(sourcePayload.sources) ? sourcePayload.sources : [];
  const health = await Promise.all(sources.map((source) => checkSourceHealth(source)));

  return apiResponse("news_reader_admin_source_health", {
    checked_at: new Date().toISOString(),
    source: sourcePayload.source || "unknown",
    sources: health,
    count: health.length,
    ok_count: health.filter((source) => source.ok).length,
    error_count: health.filter((source) => !source.ok).length
  }, {
    provenance: [
      { type: "news_reader", source: "/api/sources" },
      { type: "rss_feed", source: "configured source feed URLs" }
    ]
  });
}

async function lifeGraphIntelWorksPayload({ sourceId = "", limit = 160 } = {}) {
  const remote = await listLifeGraphIntelWorks({ sourceId, limit });
  const data = remoteData(remote.response);
  const works = Array.isArray(data.works) ? data.works : [];

  return apiResponse("life_graph_intel_works", {
    works,
    reader_items: works.map(intelWorkToReaderItem),
    count: works.length,
    remote: remote.response
  }, {
    blockers: remote.blockers || [],
    provenance: [{ type: "life_graph_api", source: "/api/intel/works" }]
  });
}

async function lifeGraphReaderWorksPayload({ view = "unread", sourceId = "", limit = 160 } = {}) {
  const remote = await listLifeGraphReaderWorks({ view, sourceId, limit });
  const data = remoteData(remote.response);
  const works = Array.isArray(data.works) ? data.works : [];

  return apiResponse("life_graph_intel_reader_works", {
    view: data.view || view,
    works,
    reader_items: works.map(intelWorkToReaderItem),
    count: works.length,
    remote: remote.response
  }, {
    blockers: remote.blockers || [],
    provenance: [{ type: "life_graph_api", source: "/api/intel/reader/works" }]
  });
}

async function updateReaderStatePayload({ workId, action }) {
  const remote = await updateLifeGraphReaderState({
    workId,
    action,
    payload: { client: "news-reader" }
  });

  return apiResponse("life_graph_intel_reader_state", {
    remote: remote.response,
    state: remoteData(remote.response).state || null
  }, {
    blockers: remote.blockers || [],
    provenance: [{ type: "life_graph_api", source: "/api/intel/reader/state" }]
  });
}

async function readerPreferencesPayload() {
  const remote = await getLifeGraphReaderPreferences();
  const data = remoteData(remote.response);

  return apiResponse("life_graph_intel_reader_preferences", {
    preferences: data.preferences || null,
    remote: remote.response
  }, {
    blockers: remote.blockers || [],
    provenance: [{ type: "life_graph_api", source: "/api/intel/reader/preferences" }]
  });
}

async function upsertReaderPreferencesPayload({ preferences }) {
  const remote = await upsertLifeGraphReaderPreferences({ preferences });
  const data = remoteData(remote.response);

  return apiResponse("life_graph_intel_reader_preferences_upsert", {
    preferences: data.preferences || null,
    remote: remote.response
  }, {
    blockers: remote.blockers || [],
    provenance: [{ type: "life_graph_api", source: "/api/intel/reader/preferences" }]
  });
}

async function upsertReaderNotePayload({ workId, note }) {
  const remote = await upsertLifeGraphReaderNote({ workId, note });
  const data = remoteData(remote.response);

  return apiResponse("life_graph_intel_reader_note", {
    note: data.note || null,
    remote: remote.response
  }, {
    blockers: remote.blockers || [],
    provenance: [{ type: "life_graph_api", source: "/api/intel/reader/notes" }]
  });
}

async function extractionReviewPayload({ view = "saved", limit = 20 } = {}) {
  const remote = await reviewLifeGraphExtractions({ view, limit });
  const data = remoteData(remote.response);

  return apiResponse("life_graph_intel_extractions_review", {
    view: data.view || view,
    candidates: Array.isArray(data.candidates) ? data.candidates : [],
    count: data.count || 0,
    remote: remote.response
  }, {
    blockers: remote.blockers || [],
    provenance: [{ type: "life_graph_api", source: "/api/intel/extractions/review" }]
  });
}

async function extractionApplyPayload({ workIds, apply = false }) {
  const remote = await applyLifeGraphExtractions({ workIds, apply });
  const data = remoteData(remote.response);

  return apiResponse("life_graph_intel_extractions_apply", {
    applied: Boolean(data.applied),
    dry_run: data.dry_run !== false,
    count: data.count || 0,
    extractions: Array.isArray(data.extractions) ? data.extractions : [],
    remote: remote.response
  }, {
    blockers: remote.blockers || [],
    provenance: [{ type: "life_graph_api", source: "/api/intel/extractions/apply" }]
  });
}

async function retentionApplyPayload({ apply = false } = {}) {
  const remote = await applyLifeGraphRetention({ apply });

  return apiResponse("life_graph_intel_retention_apply", {
    remote: remote.response,
    dry_run: !apply,
    count: remoteData(remote.response).count || 0
  }, {
    blockers: remote.blockers || [],
    provenance: [{ type: "life_graph_api", source: "/api/intel/retention/apply" }]
  });
}

function fixturePayload() {
  const xml = fs.readFileSync(path.join(ROOT, "test", "fixtures", "feed.xml"), "utf8");
  const source = fixtureSource();

  return {
    generatedAt: new Date().toISOString(),
    itemCount: 2,
    errors: [],
    items: parseFeed(xml, source)
  };
}

function fixtureSource() {
  return {
    id: "fixture",
    name: "Fixture News",
    section: "Test",
    feedUrl: "fixture://feed",
    allowHosts: ["example.com"]
  };
}

async function loadItems({ refresh = false } = {}) {
  if (process.env.NEWS_READER_FIXTURE === "1") {
    return fixturePayload();
  }

  if (!refresh && feedCache.payload && Date.now() - feedCache.fetchedAt < FEED_TTL_MS) {
    return feedCache.payload;
  }

  const sources = loadSources();
  const settled = await Promise.allSettled(
    sources.map(async (source) => {
      const xml = await fetchText(source.feedUrl);
      return parseFeed(xml, source);
    })
  );
  const errors = [];
  const items = [];

  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      items.push(...result.value);
      return;
    }

    errors.push({
      source: sources[index].name,
      message: result.reason instanceof Error ? result.reason.message : String(result.reason)
    });
  });

  items.sort((a, b) => {
    const aTime = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const bTime = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return bTime - aTime;
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    itemCount: items.length,
    errors,
    items: items.slice(0, 160)
  };

  feedCache = { fetchedAt: Date.now(), payload };
  return payload;
}

async function refreshStatusPayload() {
  const durable = lifeGraphConfig().itemsSource === "life_graph"
    ? await getLifeGraphLatestNewsReaderImport()
    : { ok: false, blockers: [] };
  const durableData = remoteData(durable.response);
  const importRun = durable.ok ? durableData.import_run : null;

  return apiResponse("news_reader_refresh_status", {
    status: refreshStatus,
    durable_status: {
      source: "life_graph",
      configured: lifeGraphConfigStatus().configured,
      ok: durable.ok,
      import_run: importRun || null,
      blockers: durable.blockers || []
    },
    feed_cache: feedCache.payload
      ? {
          fetched_at: new Date(feedCache.fetchedAt).toISOString(),
          generated_at: feedCache.payload.generatedAt,
          item_count: feedCache.payload.itemCount,
          error_count: feedCache.payload.errors?.length || 0
        }
      : null,
    schedule: {
      github_actions: ".github/workflows/daily-news-import.yml",
      cadence: "17 minutes past every third hour"
    },
    config: lifeGraphConfigStatus()
  }, {
    provenance: [
      { type: "process_memory", source: "news-reader refresh status cache" },
      { type: "life_graph_api", source: "/api/intel/imports/news-reader/latest" },
      { type: "repo_local", source: ".github/workflows/daily-news-import.yml" }
    ]
  });
}

async function readerSourcesPayload() {
  if (lifeGraphConfig().itemsSource !== "life_graph") {
    return { sources: loadSources(), source: "feed", errors: [] };
  }

  const sources = await loadLifeGraphReaderSources();

  if (sources.length) {
    return { sources, source: "life_graph", errors: [] };
  }

  return {
    sources: loadSources(),
    source: "feed_fallback",
    errors: [
      {
        source: "Life Graph",
        message: "Life Graph source list returned no sources."
      }
    ]
  };
}

async function loadLifeGraphReaderSources() {
  const remote = await listLifeGraphIntelSources({ limit: 500 });

  if (remote.ok) {
    const data = remoteData(remote.response);
    const sources = Array.isArray(data.sources) ? data.sources.map(intelSourceToReaderSource) : [];

    return sources;
  }

  return [];
}

async function allowedReaderSources() {
  if (lifeGraphConfig().itemsSource === "life_graph") {
    const sources = await loadLifeGraphReaderSources();

    if (sources.length) {
      return sources;
    }
  }

  return loadSources();
}

async function readerItemsPayload({ refresh = false, view = "unread" } = {}) {
  if (lifeGraphConfig().itemsSource !== "life_graph") {
    return { ...(await loadItems({ refresh })), view: "feed" };
  }

  const remote = await listLifeGraphReaderWorks({ view, limit: 160 });

  if (remote.ok) {
    const data = remoteData(remote.response);
    const works = Array.isArray(data.works) ? data.works : [];
    const items = works.map(intelWorkToReaderItem);

    return {
      generatedAt: new Date().toISOString(),
      itemCount: items.length,
      source: "life_graph",
      view: data.view || view,
      errors: [],
      items
    };
  }

  const fallback = await loadItems({ refresh });

  return {
    ...fallback,
    source: "feed_fallback",
    view: "feed_fallback",
    errors: [
      {
        source: "Life Graph",
        message:
          (remote.blockers || []).map((blocker) => blocker.message || blocker.code).join("; ") ||
          "Life Graph works list returned no works."
      },
      ...fallback.errors
    ]
  };
}

async function refreshReaderItemsPayload({ view = "unread" } = {}) {
  if (lifeGraphConfig().itemsSource !== "life_graph") {
    const payload = {
      ...(await readerItemsPayload({ refresh: true, view })),
      refresh: {
        ok: true,
        mode: "feed"
      }
    };

    refreshStatus = {
      last_attempt_at: payload.generatedAt,
      last_success_at: payload.generatedAt,
      ok: true,
      mode: "feed",
      item_count: payload.itemCount,
      source: "api.items.refresh",
      remote_counts: null,
      blockers: []
    };

    return payload;
  }

  const importPayload = await scheduledNewsImportPayload({ refresh: true, apply: true });

  if (!importPayload.ok) {
    return importPayload;
  }

  const itemsPayload = await readerItemsPayload({ refresh: false, view });
  refreshStatus = {
    last_attempt_at: importPayload.data?.generated_at || new Date().toISOString(),
    last_success_at: itemsPayload.generatedAt,
    ok: true,
    mode: "life_graph",
    item_count: itemsPayload.itemCount,
    source: "api.items.refresh",
    remote_counts: importPayload.data?.remote_counts || null,
    blockers: []
  };

  return {
    ...itemsPayload,
    refresh: {
      ok: true,
      mode: "life_graph",
      import: importPayload.data
    }
  };
}

function hostAllowed(articleUrl, sources) {
  const parsed = new URL(articleUrl);
  const host = parsed.hostname.replace(/^www\./, "");

  return sources.some((source) =>
    (source.allowHosts || []).some((allowed) => {
      const cleanAllowed = allowed.replace(/^www\./, "");
      return host === cleanAllowed || host.endsWith(`.${cleanAllowed}`);
    })
  );
}

function firstMatch(html, patterns) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      return decodeEntities(match[1]).trim();
    }
  }

  return "";
}

function extractReadableText(html, articleUrl) {
  const title = stripHtml(firstMatch(html, [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+name=["']title["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<title[^>]*>([\s\S]*?)<\/title>/i
  ]));
  const sourceHtml =
    firstMatch(html, [/(<article\b[\s\S]*?<\/article>)/i, /(<main\b[\s\S]*?<\/main>)/i]) ||
    firstMatch(html, [/<body\b[^>]*>([\s\S]*?)<\/body>/i]) ||
    html;
  const cleaned = sourceHtml
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<(nav|header|footer|aside|form|button)\b[\s\S]*?<\/\1>/gi, " ");
  const paragraphs = [];
  const seen = new Set();
  const paragraphPattern = /<(p|h2|h3|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;

  while ((match = paragraphPattern.exec(cleaned))) {
    const text = stripHtml(match[2]);

    if (text.length < 35 || seen.has(text)) {
      continue;
    }

    seen.add(text);
    paragraphs.push(text);
  }

  const text = paragraphs.length > 0 ? paragraphs.join("\n\n") : stripHtml(cleaned);

  return {
    title,
    url: articleUrl,
    text: text.slice(0, 30000),
    truncated: text.length > 30000
  };
}

async function readArticle(articleUrl) {
  const cached = readCache.get(articleUrl);

  if (cached && Date.now() - cached.fetchedAt < READ_TTL_MS) {
    return cached.payload;
  }

  const sources = await allowedReaderSources();

  if (!hostAllowed(articleUrl, sources)) {
    const allowed = sources.flatMap((source) => source.allowHosts || []);
    const error = new Error(`URL host is not in configured sources. Allowed hosts: ${allowed.join(", ")}`);
    error.status = 403;
    throw error;
  }

  const html = await fetchText(articleUrl);
  const payload = extractReadableText(html, articleUrl);

  readCache.set(articleUrl, { fetchedAt: Date.now(), payload });
  return payload;
}

function contentTypeFor(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}

function serveStatic(req, res, pathname) {
  const requested = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (err, body) => {
    if (err) {
      sendText(res, 404, "Not found");
      return;
    }

    sendText(res, 200, body, contentTypeFor(filePath));
  });
}

async function handle(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const postOnlyPaths = new Set([
    "/api/life-graph/import/dry-run",
    "/api/life-graph/import/remote-dry-run",
    "/api/life-graph/import/apply",
    "/api/items/refresh",
    "/api/admin/sources/state",
    "/api/life-graph/intel/reader/state",
    "/api/life-graph/intel/reader/notes",
    "/api/life-graph/intel/extractions/apply",
    "/api/life-graph/intel/retention/apply"
  ]);

  try {
    if (requestUrl.pathname === "/api/health") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (requestUrl.pathname === "/login") {
      await handleLogin(req, res, requestUrl);
      return;
    }

    if (requestUrl.pathname === "/logout") {
      redirect(res, "/login", {
        "set-cookie": clearSessionCookie(authConfig())
      });
      return;
    }

    if (requestUrl.pathname === "/admin") {
      redirect(res, "/admin.html");
      return;
    }

    if (requestUrl.pathname === "/review") {
      redirect(res, "/review.html");
      return;
    }

    if (requestUrl.pathname === "/api/cron/news-import") {
      if (!["GET", "POST"].includes(req.method)) {
        sendJson(res, 405, { error: "Method not allowed" });
        return;
      }

      const authBlockers = cronAuthBlockers(req);

      if (authBlockers.length) {
        sendJson(res, blockerHttpStatus(authBlockers), apiResponse("cron.news_import", null, { blockers: authBlockers }));
        return;
      }

      const payload = await scheduledNewsImportPayload({
        refresh: requestUrl.searchParams.get("refresh") !== "0",
        apply: requestUrl.searchParams.get("dry_run") !== "1"
      });

      sendJson(res, payload.ok ? 200 : blockerHttpStatus(payload.blockers), payload);
      return;
    }

    if (!isAuthorized(req)) {
      handleUnauthorized(req, res, requestUrl.pathname);
      return;
    }

    if (postOnlyPaths.has(requestUrl.pathname) && req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    if (requestUrl.pathname === "/api/sources") {
      sendJson(res, 200, await readerSourcesPayload());
      return;
    }

    if (requestUrl.pathname === "/api/admin/sources" && req.method === "GET") {
      const payload = await adminSourcesPayload();
      sendJson(res, payload.ok ? 200 : blockerHttpStatus(payload.blockers), payload);
      return;
    }

    if (requestUrl.pathname === "/api/admin/sources/health") {
      sendJson(res, 200, await adminSourceHealthPayload());
      return;
    }

    if (requestUrl.pathname === "/api/admin/refresh/status") {
      sendJson(res, 200, await refreshStatusPayload());
      return;
    }

    if (requestUrl.pathname === "/api/admin/sources") {
      const body = await readJsonBody(req);
      const payload = await upsertAdminSourcePayload(body);
      sendJson(res, payload.ok ? 200 : blockerHttpStatus(payload.blockers), payload);
      return;
    }

    if (requestUrl.pathname === "/api/admin/sources/state") {
      const body = await readJsonBody(req);
      const payload = await setAdminSourceStatePayload(body);
      sendJson(res, payload.ok ? 200 : blockerHttpStatus(payload.blockers), payload);
      return;
    }

    if (requestUrl.pathname === "/api/graph/sources") {
      sendJson(res, 200, graphSourcesPayload());
      return;
    }

    if (requestUrl.pathname === "/api/graph/contracts") {
      sendJson(res, 200, graphContractsPayload());
      return;
    }

    if (requestUrl.pathname === "/api/life-graph/migrations") {
      sendJson(res, 200, lifeGraphMigrationsPayload());
      return;
    }

    if (requestUrl.pathname === "/api/life-graph/status") {
      sendJson(res, 200, lifeGraphStatusPayload());
      return;
    }

    if (requestUrl.pathname === "/api/items") {
      const refresh = requestUrl.searchParams.get("refresh") === "1";
      sendJson(res, 200, await readerItemsPayload({ refresh, view: requestUrl.searchParams.get("view") || "unread" }));
      return;
    }

    if (requestUrl.pathname === "/api/items/refresh") {
      const payload = await refreshReaderItemsPayload({ view: requestUrl.searchParams.get("view") || "unread" });
      sendJson(res, payload.ok === false ? blockerHttpStatus(payload.blockers) : 200, payload);
      return;
    }

    if (requestUrl.pathname === "/api/graph/works") {
      const refresh = requestUrl.searchParams.get("refresh") === "1";
      sendJson(res, 200, await graphWorksPayload({ refresh }));
      return;
    }

    if (requestUrl.pathname === "/api/life-graph/import/dry-run") {
      const refresh = requestUrl.searchParams.get("refresh") === "1";
      sendJson(res, 200, await lifeGraphImportDryRunPayload({ refresh }));
      return;
    }

    if (requestUrl.pathname === "/api/life-graph/import/remote-dry-run") {
      const refresh = requestUrl.searchParams.get("refresh") === "1";
      sendJson(res, 200, await pushLifeGraphImportPayload({ refresh, apply: false }));
      return;
    }

    if (requestUrl.pathname === "/api/life-graph/import/apply") {
      const refresh = requestUrl.searchParams.get("refresh") === "1";
      sendJson(res, 200, await pushLifeGraphImportPayload({ refresh, apply: true }));
      return;
    }

    if (requestUrl.pathname === "/api/life-graph/intel/sources") {
      sendJson(res, 200, await lifeGraphIntelSourcesPayload());
      return;
    }

    if (requestUrl.pathname === "/api/life-graph/intel/works") {
      sendJson(
        res,
        200,
        await lifeGraphIntelWorksPayload({
          sourceId: requestUrl.searchParams.get("source_id") || "",
          limit: Number.parseInt(requestUrl.searchParams.get("limit") || "160", 10)
        })
      );
      return;
    }

    if (requestUrl.pathname === "/api/life-graph/intel/reader/works") {
      sendJson(
        res,
        200,
        await lifeGraphReaderWorksPayload({
          view: requestUrl.searchParams.get("view") || "unread",
          sourceId: requestUrl.searchParams.get("source_id") || "",
          limit: Number.parseInt(requestUrl.searchParams.get("limit") || "160", 10)
        })
      );
      return;
    }

    if (requestUrl.pathname === "/api/life-graph/intel/reader/state") {
      const body = await readJsonBody(req);
      sendJson(
        res,
        200,
        await updateReaderStatePayload({
          workId: body.work_id || body.workId || "",
          action: body.action || ""
        })
      );
      return;
    }

    if (requestUrl.pathname === "/api/life-graph/intel/reader/preferences" && req.method === "GET") {
      const payload = await readerPreferencesPayload();
      sendJson(res, payload.ok ? 200 : blockerHttpStatus(payload.blockers), payload);
      return;
    }

    if (requestUrl.pathname === "/api/life-graph/intel/reader/preferences") {
      const body = await readJsonBody(req);
      const payload = await upsertReaderPreferencesPayload({
        preferences: body.preferences && typeof body.preferences === "object" ? body.preferences : body
      });
      sendJson(res, payload.ok ? 200 : blockerHttpStatus(payload.blockers), payload);
      return;
    }

    if (requestUrl.pathname === "/api/life-graph/intel/reader/notes") {
      const body = await readJsonBody(req);
      const payload = await upsertReaderNotePayload({
        workId: body.work_id || body.workId || "",
        note: body.note || ""
      });
      sendJson(res, payload.ok ? 200 : blockerHttpStatus(payload.blockers), payload);
      return;
    }

    if (requestUrl.pathname === "/api/life-graph/intel/extractions/review") {
      const payload = await extractionReviewPayload({
        view: requestUrl.searchParams.get("view") || "saved",
        limit: Number.parseInt(requestUrl.searchParams.get("limit") || "20", 10)
      });
      sendJson(res, payload.ok ? 200 : blockerHttpStatus(payload.blockers), payload);
      return;
    }

    if (requestUrl.pathname === "/api/life-graph/intel/extractions/apply") {
      const body = await readJsonBody(req);
      const payload = await extractionApplyPayload({
        workIds: Array.isArray(body.work_ids) ? body.work_ids : [],
        apply: Boolean(body.apply)
      });
      sendJson(res, payload.ok ? 200 : blockerHttpStatus(payload.blockers), payload);
      return;
    }

    if (requestUrl.pathname === "/api/life-graph/intel/retention/apply") {
      const body = await readJsonBody(req);
      sendJson(res, 200, await retentionApplyPayload({ apply: Boolean(body.apply) }));
      return;
    }

    if (requestUrl.pathname === "/api/read") {
      const articleUrl = requestUrl.searchParams.get("url");

      if (!articleUrl) {
        sendJson(res, 400, { error: "Missing url parameter" });
        return;
      }

      sendJson(res, 200, await readArticle(articleUrl));
      return;
    }

    serveStatic(req, res, requestUrl.pathname);
  } catch (err) {
    const status = err && Number.isInteger(err.status) ? err.status : 500;
    sendJson(res, status, {
      error: err instanceof Error ? err.message : String(err)
    });
  }
}

const server = http.createServer((req, res) => {
  handle(req, res);
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`News Reader running at http://${HOST}:${PORT}`);
  });
}

module.exports = {
  handle,
  server
};
