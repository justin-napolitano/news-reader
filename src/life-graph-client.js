function lifeGraphConfig(env = process.env) {
  return {
    apiBaseUrl: String(env.LIFE_GRAPH_API_BASE_URL || "").replace(/\/+$/, ""),
    writeTokenConfigured: Boolean(env.LIFE_GRAPH_WRITE_TOKEN || ""),
    itemsSource: String(env.NEWS_READER_ITEMS_SOURCE || env.LIFE_GRAPH_ITEMS_SOURCE || "feed").toLowerCase()
  };
}

function lifeGraphConfigured(env = process.env) {
  const config = lifeGraphConfig(env);
  return Boolean(config.apiBaseUrl && config.writeTokenConfigured);
}

function lifeGraphConfigStatus(env = process.env) {
  const config = lifeGraphConfig(env);

  return {
    ok: true,
    api_base_url_configured: Boolean(config.apiBaseUrl),
    write_token_configured: config.writeTokenConfigured,
    items_source: config.itemsSource,
    configured: Boolean(config.apiBaseUrl && config.writeTokenConfigured)
  };
}

function configBlockers({ requireWriteToken = true, env = process.env } = {}) {
  const config = lifeGraphConfig(env);
  const blockers = [];

  if (!config.apiBaseUrl) {
    blockers.push({
      code: "life_graph_api_base_url_missing",
      message: "Set LIFE_GRAPH_API_BASE_URL before calling the Life Graph API."
    });
  }

  if (requireWriteToken && !config.writeTokenConfigured) {
    blockers.push({
      code: "life_graph_write_token_missing",
      message: "Set LIFE_GRAPH_WRITE_TOKEN before calling authenticated Life Graph endpoints."
    });
  }

  return blockers;
}

function buildLifeGraphUrl(path, env = process.env) {
  const config = lifeGraphConfig(env);
  return new URL(path, `${config.apiBaseUrl}/`).toString();
}

async function parseJsonResponse(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    return {
      ok: false,
      blockers: [
        {
          code: "life_graph_response_not_json",
          message: err instanceof Error ? err.message : String(err),
          body_preview: text.slice(0, 500)
        }
      ]
    };
  }
}

async function callLifeGraph(path, { method = "GET", body = null, requireWriteToken = true, env = process.env } = {}) {
  const blockers = configBlockers({ requireWriteToken, env });

  if (blockers.length) {
    return { ok: false, status: "blocked", status_code: 0, blockers, response: null };
  }

  const headers = {
    accept: "application/json"
  };
  const token = env.LIFE_GRAPH_WRITE_TOKEN || "";

  if (token) {
    headers["x-life-graph-write-token"] = token;
  }

  if (body !== null) {
    headers["content-type"] = "application/json";
  }

  try {
    const response = await fetch(buildLifeGraphUrl(path, env), {
      method,
      headers,
      body: body === null ? undefined : JSON.stringify(body)
    });
    const payload = await parseJsonResponse(response);
    const remoteBlockers = Array.isArray(payload.blockers) ? payload.blockers : [];

    if (!response.ok) {
      return {
        ok: false,
        status: "blocked",
        status_code: response.status,
        blockers: remoteBlockers.length
          ? remoteBlockers
          : [{ code: "life_graph_http_error", status: response.status, message: response.statusText }],
        response: payload
      };
    }

    if (payload.ok === false || remoteBlockers.length) {
      return {
        ok: false,
        status: "blocked",
        status_code: response.status,
        blockers: remoteBlockers.length ? remoteBlockers : [{ code: "life_graph_response_blocked" }],
        response: payload
      };
    }

    return { ok: true, status: "ok", status_code: response.status, blockers: [], response: payload };
  } catch (err) {
    return {
      ok: false,
      status: "blocked",
      status_code: 0,
      blockers: [
        {
          code: "life_graph_request_failed",
          message: err instanceof Error ? err.message : String(err)
        }
      ],
      response: null
    };
  }
}

function remoteData(response) {
  if (!response || typeof response !== "object") {
    return {};
  }

  return response.data && typeof response.data === "object" ? response.data : response;
}

async function sendNewsReaderImport(payload, { apply = false, env = process.env } = {}) {
  return callLifeGraph(`/api/intel/imports/news-reader/${apply ? "apply" : "dry-run"}`, {
    method: "POST",
    body: { payload },
    requireWriteToken: true,
    env
  });
}

async function listLifeGraphIntelSources({ limit = 100, includeDisabled = false, env = process.env } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });

  if (includeDisabled) {
    params.set("include_disabled", "1");
  }

  return callLifeGraph(`/api/intel/sources?${params.toString()}`, {
    method: "GET",
    requireWriteToken: true,
    env
  });
}

async function upsertLifeGraphIntelSource({ source, env = process.env }) {
  return callLifeGraph("/api/intel/sources", {
    method: "POST",
    body: {
      actor_id: "news-reader-admin",
      source
    },
    requireWriteToken: true,
    env
  });
}

async function setLifeGraphIntelSourceEnabled({ sourceId, enabled, env = process.env }) {
  return callLifeGraph(`/api/intel/sources/${encodeURIComponent(sourceId)}/state`, {
    method: "POST",
    body: {
      actor_id: "news-reader-admin",
      enabled
    },
    requireWriteToken: true,
    env
  });
}

async function listLifeGraphIntelWorks({ sourceId = "", limit = 160, env = process.env } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });

  if (sourceId) {
    params.set("source_id", sourceId);
  }

  return callLifeGraph(`/api/intel/works?${params.toString()}`, {
    method: "GET",
    requireWriteToken: true,
    env
  });
}

async function listLifeGraphReaderWorks({ view = "unread", sourceId = "", limit = 160, env = process.env } = {}) {
  const params = new URLSearchParams({ view, limit: String(limit) });

  if (sourceId) {
    params.set("source_id", sourceId);
  }

  return callLifeGraph(`/api/intel/reader/works?${params.toString()}`, {
    method: "GET",
    requireWriteToken: true,
    env
  });
}

async function updateLifeGraphReaderState({ workId, action, actorId = "user:default", payload = {}, env = process.env }) {
  return callLifeGraph("/api/intel/reader/state", {
    method: "POST",
    body: {
      work_id: workId,
      action,
      actor_id: actorId,
      payload
    },
    requireWriteToken: true,
    env
  });
}

async function applyLifeGraphRetention({ apply = false, actorId = "user:default", env = process.env } = {}) {
  return callLifeGraph("/api/intel/retention/apply", {
    method: "POST",
    body: {
      apply,
      actor_id: actorId
    },
    requireWriteToken: true,
    env
  });
}

function intelSourceToReaderSource(source) {
  return {
    id: source.id,
    name: source.name || source.id,
    section: source.section || "",
    feedUrl: source.feed_url || "",
    allowHosts: Array.isArray(source.allow_hosts) ? source.allow_hosts : []
  };
}

function intelWorkToReaderItem(work) {
  const readerState = work.reader_state && typeof work.reader_state === "object" ? work.reader_state : {};

  return {
    id: work.id,
    sourceId: work.source_id,
    source: work.source_name || work.source_id,
    section: work.section || "",
    title: work.title,
    url: work.url,
    publishedAt: work.published_at || "",
    excerpt: work.excerpt || "",
    readerState
  };
}

module.exports = {
  callLifeGraph,
  intelSourceToReaderSource,
  intelWorkToReaderItem,
  applyLifeGraphRetention,
  lifeGraphConfig,
  lifeGraphConfigStatus,
  lifeGraphConfigured,
  listLifeGraphIntelSources,
  listLifeGraphIntelWorks,
  listLifeGraphReaderWorks,
  remoteData,
  sendNewsReaderImport,
  setLifeGraphIntelSourceEnabled,
  upsertLifeGraphIntelSource,
  updateLifeGraphReaderState
};
