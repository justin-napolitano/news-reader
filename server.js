const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { URL } = require("url");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const SOURCE_PATH = path.join(ROOT, "data", "sources.json");
const PORT = Number.parseInt(process.env.PORT || "4175", 10);
const HOST = process.env.HOST || "127.0.0.1";
const FEED_TTL_MS = 10 * 60 * 1000;
const READ_TTL_MS = 20 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12000;
const USER_AGENT = "NewsReader/0.1 (+local personal reader)";

let feedCache = { fetchedAt: 0, payload: null };
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

function sendText(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "content-type": contentType,
    "cache-control": "no-store"
  });
  res.end(body);
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
  return readJson(SOURCE_PATH).sources;
}

function fixturePayload() {
  const xml = fs.readFileSync(path.join(ROOT, "test", "fixtures", "feed.xml"), "utf8");
  const source = {
    id: "fixture",
    name: "Fixture News",
    section: "Test",
    feedUrl: "fixture://feed",
    allowHosts: ["example.com"]
  };

  return {
    generatedAt: new Date().toISOString(),
    itemCount: 2,
    errors: [],
    items: parseFeed(xml, source)
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

  const sources = loadSources();

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

  try {
    if (requestUrl.pathname === "/api/health") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (requestUrl.pathname === "/api/sources") {
      sendJson(res, 200, { sources: loadSources() });
      return;
    }

    if (requestUrl.pathname === "/api/items") {
      const refresh = requestUrl.searchParams.get("refresh") === "1";
      sendJson(res, 200, await loadItems({ refresh }));
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

server.listen(PORT, HOST, () => {
  console.log(`News Reader running at http://${HOST}:${PORT}`);
});
