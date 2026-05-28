const RELEVANCE_KEY = "news-reader:relevance-controls";

const state = {
  sources: [],
  extractionCandidates: []
};

const els = {
  form: document.querySelector("#source-form"),
  relevanceForm: document.querySelector("#relevance-form"),
  status: document.querySelector("#admin-status"),
  relevanceStatus: document.querySelector("#relevance-status"),
  list: document.querySelector("#admin-source-list"),
  healthList: document.querySelector("#source-health-list"),
  refreshStatusList: document.querySelector("#refresh-status-list"),
  extractionList: document.querySelector("#extraction-list"),
  reload: document.querySelector("#reload-sources"),
  checkHealth: document.querySelector("#check-health"),
  reloadRefreshStatus: document.querySelector("#reload-refresh-status"),
  runRefresh: document.querySelector("#run-refresh"),
  clearRelevance: document.querySelector("#clear-relevance"),
  refreshStatus: document.querySelector("#refresh-status"),
  extractionStatus: document.querySelector("#extraction-status"),
  loadExtractions: document.querySelector("#load-extractions"),
  applyExtractions: document.querySelector("#apply-extractions")
};

function listFromField(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function sourceIdFromName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sourceFromForm() {
  const formData = new FormData(els.form);
  const name = String(formData.get("name") || "").trim();

  return {
    id: sourceIdFromName(formData.get("id") || name),
    name,
    section: String(formData.get("section") || "").trim(),
    feedUrl: String(formData.get("feedUrl") || "").trim(),
    allowHosts: listFromField(formData.get("allowHosts")),
    tags: listFromField(formData.get("tags"))
  };
}

function blockerMessage(payload, fallback) {
  const blocker = Array.isArray(payload?.blockers) ? payload.blockers[0] : null;

  return blocker?.message || blocker?.code || payload?.error || fallback;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const payload = await response.json();

  if (!response.ok || payload.ok === false) {
    throw new Error(blockerMessage(payload, "Request failed."));
  }

  return payload;
}

function setStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.classList.toggle("error", isError);
}

function setRelevanceStatus(message, isError = false) {
  els.relevanceStatus.textContent = message;
  els.relevanceStatus.classList.toggle("error", isError);
}

function setExtractionStatus(message, isError = false) {
  els.extractionStatus.textContent = message;
  els.extractionStatus.classList.toggle("error", isError);
}

function setRefreshStatus(message, isError = false) {
  els.refreshStatus.textContent = message;
  els.refreshStatus.classList.toggle("error", isError);
}

function loadRelevanceControls() {
  try {
    return JSON.parse(window.localStorage.getItem(RELEVANCE_KEY) || "{}");
  } catch (_err) {
    return {};
  }
}

function saveRelevanceControls(controls) {
  window.localStorage.setItem(RELEVANCE_KEY, JSON.stringify({ version: 1, ...controls }));
}

function fillRelevanceForm() {
  const controls = loadRelevanceControls();

  els.relevanceForm.elements.priorityTerms.value = (controls.priorityTerms || []).join(", ");
  els.relevanceForm.elements.hiddenTerms.value = (controls.hiddenTerms || []).join(", ");
  els.relevanceForm.elements.prioritySources.value = (controls.prioritySources || []).join(", ");
}

async function loadRemoteRelevanceControls() {
  try {
    const payload = await api("/api/life-graph/intel/reader/preferences");
    const preferences = payload.data?.preferences;

    if (preferences) {
      saveRelevanceControls({
        priorityTerms: preferences.priority_terms || [],
        hiddenTerms: preferences.hidden_terms || [],
        prioritySources: preferences.priority_sources || []
      });
      fillRelevanceForm();
      setRelevanceStatus("Controls loaded from Life Graph.");
    }
  } catch (_err) {
    fillRelevanceForm();
  }
}

function relevanceFromForm() {
  const formData = new FormData(els.relevanceForm);

  return {
    priorityTerms: listFromField(formData.get("priorityTerms")).map((term) => term.toLowerCase()),
    hiddenTerms: listFromField(formData.get("hiddenTerms")).map((term) => term.toLowerCase()),
    prioritySources: listFromField(formData.get("prioritySources")).map((term) => term.toLowerCase())
  };
}

function renderSources() {
  els.list.innerHTML = "";

  state.sources.forEach((source) => {
    const li = document.createElement("li");
    const body = document.createElement("div");
    const name = document.createElement("strong");
    const meta = document.createElement("span");
    const details = document.createElement("p");
    const actions = document.createElement("div");
    const edit = document.createElement("button");
    const toggle = document.createElement("button");
    const enabled = source.isEnabled !== false;

    li.className = enabled ? "" : "is-disabled";
    body.className = "admin-source-body";
    name.textContent = source.name || source.id;
    meta.textContent = [source.section, source.id, enabled ? "enabled" : "disabled"].filter(Boolean).join(" / ");
    details.textContent = source.feedUrl || source.feed_url || "No feed URL";
    body.append(name, meta, details);

    actions.className = "admin-source-actions";
    edit.type = "button";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => {
      els.form.elements.name.value = source.name || "";
      els.form.elements.id.value = source.id || "";
      els.form.elements.section.value = source.section || "";
      els.form.elements.feedUrl.value = source.feedUrl || "";
      els.form.elements.allowHosts.value = (source.allowHosts || []).join(", ");
      els.form.elements.tags.value = (source.tags || []).join(", ");
      setStatus(`Editing ${source.name || source.id}.`);
      els.form.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    toggle.type = "button";
    toggle.textContent = enabled ? "Remove" : "Restore";
    toggle.addEventListener("click", () => setSourceEnabled(source.id, !enabled));
    actions.append(edit, toggle);
    li.append(body, actions);
    els.list.appendChild(li);
  });
}

async function loadSources() {
  setStatus("Loading sources...");

  try {
    const payload = await api("/api/admin/sources");
    state.sources = payload.data?.sources || [];
    renderSources();
    setStatus(`${state.sources.length} sources loaded.`);
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), true);
  }
}

function renderHealth(sources) {
  els.healthList.innerHTML = "";

  sources.forEach((source) => {
    const li = document.createElement("li");
    const body = document.createElement("div");
    const name = document.createElement("strong");
    const meta = document.createElement("span");
    const details = document.createElement("p");

    li.className = source.ok ? "" : "is-disabled";
    body.className = "admin-source-body";
    name.textContent = source.name || source.id;
    meta.textContent = [source.status, `${source.itemCount} items`, `${source.responseMs}ms`].filter(Boolean).join(" / ");
    details.textContent = source.message || source.feedUrl || "";
    body.append(name, meta, details);
    li.appendChild(body);
    els.healthList.appendChild(li);
  });
}

function renderRefreshStatus(data) {
  const status = data.status || {};
  const feedCache = data.feed_cache || {};
  const schedule = data.schedule || {};
  const rows = [
    ["Last attempt", status.last_attempt_at || "Not run in this process"],
    ["Last success", status.last_success_at || "Not recorded"],
    ["Mode", status.mode || "Unknown"],
    ["Items", Number.isFinite(status.item_count) ? String(status.item_count) : "0"],
    ["Feed cache", feedCache.generated_at ? `${feedCache.item_count || 0} items at ${feedCache.generated_at}` : "Empty"],
    ["Cadence", schedule.cadence || "Not configured"]
  ];

  els.refreshStatusList.innerHTML = "";
  rows.forEach(([label, value]) => {
    const li = document.createElement("li");
    const body = document.createElement("div");
    const title = document.createElement("strong");
    const detail = document.createElement("p");

    body.className = "admin-source-body";
    title.textContent = label;
    detail.textContent = value;
    body.append(title, detail);
    li.appendChild(body);
    els.refreshStatusList.appendChild(li);
  });

  if (Array.isArray(status.blockers) && status.blockers.length) {
    setRefreshStatus(status.blockers.map((blocker) => blocker.message || blocker.code).join("; "), true);
    return;
  }

  setRefreshStatus(status.ok === false ? "Last refresh failed." : "Refresh status loaded.");
}

function renderExtractions() {
  els.extractionList.innerHTML = "";

  state.extractionCandidates.forEach((candidate) => {
    const li = document.createElement("li");
    const body = document.createElement("div");
    const title = document.createElement("strong");
    const meta = document.createElement("span");
    const details = document.createElement("p");
    const extraction = candidate.extraction || {};
    const topicNames = (extraction.topics || []).map((topic) => topic.name).slice(0, 5);
    const entityNames = (extraction.entities || []).map((entity) => entity.name).slice(0, 5);

    body.className = "admin-source-body";
    title.textContent = candidate.work?.title || candidate.work?.id || "Untitled";
    meta.textContent = [
      `${topicNames.length} topics`,
      `${entityNames.length} entities`,
      `score ${Math.round((extraction.relevance_score || 0) * 100)}`
    ].join(" / ");
    details.textContent = [
      topicNames.length ? `Topics: ${topicNames.join(", ")}` : "",
      entityNames.length ? `Entities: ${entityNames.join(", ")}` : ""
    ].filter(Boolean).join(" | ");
    body.append(title, meta, details);
    li.appendChild(body);
    els.extractionList.appendChild(li);
  });
}

async function loadExtractions() {
  els.loadExtractions.disabled = true;
  setExtractionStatus("Loading extraction candidates...");

  try {
    const payload = await api("/api/life-graph/intel/extractions/review?view=saved&limit=20");
    state.extractionCandidates = payload.data?.candidates || [];
    renderExtractions();
    setExtractionStatus(`${state.extractionCandidates.length} saved articles ready for review.`);
  } catch (err) {
    setExtractionStatus(err instanceof Error ? err.message : String(err), true);
  } finally {
    els.loadExtractions.disabled = false;
  }
}

async function applyExtractions() {
  const workIds = state.extractionCandidates.map((candidate) => candidate.work?.id).filter(Boolean);

  if (!workIds.length) {
    setExtractionStatus("Load saved-article candidates before applying.", true);
    return;
  }

  els.applyExtractions.disabled = true;
  setExtractionStatus("Applying deterministic extraction...");

  try {
    const payload = await api("/api/life-graph/intel/extractions/apply", {
      method: "POST",
      body: JSON.stringify({ work_ids: workIds, apply: true })
    });
    setExtractionStatus(`Applied extraction for ${payload.data?.count || 0} articles.`);
  } catch (err) {
    setExtractionStatus(err instanceof Error ? err.message : String(err), true);
  } finally {
    els.applyExtractions.disabled = false;
  }
}

async function checkHealth() {
  els.checkHealth.disabled = true;
  setStatus("Checking source health...");

  try {
    const payload = await api("/api/admin/sources/health");
    renderHealth(payload.data?.sources || []);
    setStatus(`${payload.data?.ok_count || 0}/${payload.data?.count || 0} sources healthy.`);
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), true);
  } finally {
    els.checkHealth.disabled = false;
  }
}

async function loadRefreshStatus() {
  els.reloadRefreshStatus.disabled = true;
  setRefreshStatus("Loading refresh status...");

  try {
    const payload = await api("/api/admin/refresh/status");
    renderRefreshStatus(payload.data || {});
  } catch (err) {
    setRefreshStatus(err instanceof Error ? err.message : String(err), true);
  } finally {
    els.reloadRefreshStatus.disabled = false;
  }
}

async function runRefresh() {
  els.runRefresh.disabled = true;
  setRefreshStatus("Running import refresh...");

  try {
    const payload = await api("/api/items/refresh?view=unread", { method: "POST" });
    const count = payload.itemCount || payload.data?.itemCount || 0;

    setRefreshStatus(`Refresh complete. ${count} unread items available.`);
    await loadRefreshStatus();
  } catch (err) {
    setRefreshStatus(err instanceof Error ? err.message : String(err), true);
  } finally {
    els.runRefresh.disabled = false;
  }
}

async function saveSource(event) {
  event.preventDefault();
  const submit = els.form.querySelector("button[type='submit']");

  submit.disabled = true;
  setStatus("Saving source...");

  try {
    await api("/api/admin/sources", {
      method: "POST",
      body: JSON.stringify({ source: sourceFromForm() })
    });
    els.form.reset();
    await loadSources();
    setStatus("Source saved.");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), true);
  } finally {
    submit.disabled = false;
  }
}

async function setSourceEnabled(sourceId, enabled) {
  setStatus(enabled ? "Restoring source..." : "Removing source...");

  try {
    await api("/api/admin/sources/state", {
      method: "POST",
      body: JSON.stringify({ source_id: sourceId, enabled })
    });
    await loadSources();
    setStatus(enabled ? "Source restored." : "Source removed from the active reader.");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), true);
  }
}

function saveRelevance(event) {
  event.preventDefault();

  try {
    const controls = relevanceFromForm();

    saveRelevanceControls(controls);
    api("/api/life-graph/intel/reader/preferences", {
      method: "POST",
      body: JSON.stringify({ preferences: controls })
    })
      .then(() => setRelevanceStatus("Controls saved to Life Graph."))
      .catch(() => setRelevanceStatus("Controls saved in this browser; Life Graph is unavailable."));
  } catch (err) {
    setRelevanceStatus(err instanceof Error ? err.message : String(err), true);
  }
}

function clearRelevance() {
  window.localStorage.removeItem(RELEVANCE_KEY);
  fillRelevanceForm();
  setRelevanceStatus("Controls cleared.");
}

els.form.addEventListener("submit", saveSource);
els.relevanceForm.addEventListener("submit", saveRelevance);
els.reload.addEventListener("click", loadSources);
els.checkHealth.addEventListener("click", checkHealth);
els.reloadRefreshStatus.addEventListener("click", loadRefreshStatus);
els.runRefresh.addEventListener("click", runRefresh);
els.clearRelevance.addEventListener("click", clearRelevance);
els.loadExtractions.addEventListener("click", loadExtractions);
els.applyExtractions.addEventListener("click", applyExtractions);
loadRemoteRelevanceControls();
loadSources();
checkHealth();
loadRefreshStatus();
