const BASE_URL = String(process.env.NEWS_READER_BASE_URL || "https://news.selectproj.com").replace(/\/+$/, "");
const ADMIN_USER = String(process.env.NEWS_READER_ADMIN_USER || "admin");
const ADMIN_PASSCODE = String(process.env.NEWS_READER_ADMIN_PASSCODE || "");
const RUN_REFRESH = process.env.NEWS_READER_SMOKE_REFRESH === "1";

let sessionCookie = "";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };

  if (sessionCookie) {
    headers.cookie = sessionCookie;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    redirect: "manual",
    ...options,
    headers
  });
  const text = await response.text();

  return { response, text };
}

async function requestJson(path, options = {}) {
  const { response, text } = await request(path, {
    ...options,
    headers: {
      accept: "application/json",
      ...(options.headers || {})
    }
  });

  let payload = {};

  try {
    payload = text ? JSON.parse(text) : {};
  } catch (err) {
    throw new Error(`${path} did not return JSON: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { response, payload };
}

async function login() {
  assert(ADMIN_PASSCODE, "Set NEWS_READER_ADMIN_PASSCODE before running the production smoke test.");

  const login = await fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: ADMIN_USER, passcode: ADMIN_PASSCODE }),
    redirect: "manual"
  });

  assert(login.status === 303, `login returned ${login.status}`);
  assert(login.headers.get("set-cookie"), "login did not return a session cookie");
  sessionCookie = login.headers.get("set-cookie").split(";")[0];
}

async function main() {
  const health = await requestJson("/api/health");

  assert(health.response.status === 200 && health.payload.ok, "health check failed");

  const guardedHome = await fetch(`${BASE_URL}/`, { redirect: "manual" });

  assert([200, 303].includes(guardedHome.status), `home returned unexpected status ${guardedHome.status}`);

  await login();

  const home = await request("/");

  assert(home.response.status === 200 && home.text.includes("News Reader"), "home page did not render");

  const admin = await request("/admin.html");

  assert(admin.response.status === 200 && admin.text.includes("Refresh status"), "admin page did not render refresh tools");

  const review = await request("/review.html");

  assert(review.response.status === 200 && review.text.includes("review-card"), "review page did not render");

  const sources = await requestJson("/api/sources");

  assert(sources.response.status === 200 && Array.isArray(sources.payload.sources), "sources endpoint failed");

  const items = await requestJson("/api/items?view=unread");

  assert(items.response.status === 200 && Array.isArray(items.payload.items), "items endpoint failed");

  const refreshStatus = await requestJson("/api/admin/refresh/status");

  assert(refreshStatus.response.status === 200 && refreshStatus.payload.ok, "refresh status endpoint failed");

  const sourceHealth = await requestJson("/api/admin/sources/health");

  assert(sourceHealth.response.status === 200 && sourceHealth.payload.ok, "source health endpoint failed");

  let refresh = null;

  if (RUN_REFRESH) {
    refresh = await requestJson("/api/items/refresh?view=unread", { method: "POST" });
    assert(refresh.response.status === 200 && refresh.payload.ok !== false, "manual refresh failed");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        base_url: BASE_URL,
        checked: ["health", "auth", "home", "admin", "review", "sources", "items", "refresh_status", "source_health"],
        source_count: sources.payload.sources.length,
        unread_count: items.payload.items.length,
        refresh_run: Boolean(refresh)
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
