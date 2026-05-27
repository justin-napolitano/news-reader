const state = {
  sources: []
};

const els = {
  form: document.querySelector("#source-form"),
  status: document.querySelector("#admin-status"),
  list: document.querySelector("#admin-source-list"),
  reload: document.querySelector("#reload-sources")
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

els.form.addEventListener("submit", saveSource);
els.reload.addEventListener("click", loadSources);
loadSources();
