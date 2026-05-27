const state = {
  articles: [],
  sources: [],
  activeSource: "all",
  activeView: "unread"
};

const els = {
  refresh: document.querySelector("#refresh-button"),
  viewStrip: document.querySelector("#view-strip"),
  sourceStrip: document.querySelector("#source-strip"),
  status: document.querySelector("#feed-status"),
  count: document.querySelector("#feed-count"),
  list: document.querySelector("#article-list")
};

const views = [
  { id: "unread", name: "Unread" },
  { id: "saved", name: "Saved" },
  { id: "read", name: "Read" },
  { id: "archived", name: "Archived" }
];

function formatDate(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function filteredArticles() {
  if (state.activeSource === "all") {
    return state.articles;
  }

  return state.articles.filter((article) => article.sourceId === state.activeSource);
}

function articleHref(article) {
  const params = new URLSearchParams({
    url: article.url,
    title: article.title,
    source: article.source,
    section: article.section || ""
  });

  const workId = article.readerState?.work_id || article.id;

  if (workId) {
    params.set("work_id", workId);
  }

  if (article.readerState) {
    params.set("saved", article.readerState.is_saved ? "1" : "0");
    params.set("archived", article.readerState.is_hidden ? "1" : "0");
  }

  return `/reader.html?${params.toString()}`;
}

function renderViews() {
  els.viewStrip.innerHTML = "";
  views.forEach((view) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = `view-filter${state.activeView === view.id ? " is-active" : ""}`;
    button.textContent = view.name;
    button.addEventListener("click", () => {
      state.activeView = view.id;
      renderViews();
      loadArticles();
    });
    els.viewStrip.appendChild(button);
  });
}

function renderSources() {
  const buttons = [
    { id: "all", name: "All" },
    ...state.sources.map((source) => ({ id: source.id, name: source.name }))
  ];

  els.sourceStrip.innerHTML = "";
  buttons.forEach((source) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = `source-filter${state.activeSource === source.id ? " is-active" : ""}`;
    button.textContent = source.name;
    button.addEventListener("click", () => {
      state.activeSource = source.id;
      renderSources();
      renderArticles();
    });
    els.sourceStrip.appendChild(button);
  });
}

function actionForView(article) {
  if (state.activeView === "saved" || article.readerState?.is_saved) {
    return { action: "unsave", label: "Unsave" };
  }
  if (state.activeView === "archived" || article.readerState?.is_hidden) {
    return { action: "restore", label: "Restore" };
  }
  return { action: "save", label: "Save" };
}

async function updateArticleState(article, action, { silent = false } = {}) {
  if (!article.id || !article.readerState) {
    return;
  }

  try {
    await fetch("/api/life-graph/intel/reader/state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ work_id: article.id, action })
    });
    if (!silent) {
      await loadArticles();
    }
  } catch (err) {
    if (!silent) {
      els.status.textContent = err instanceof Error ? err.message : String(err);
      els.status.classList.add("error");
    }
  }
}

function renderArticles() {
  const articles = filteredArticles();

  els.count.textContent = `${articles.length} items`;
  els.list.innerHTML = "";

  articles.forEach((article) => {
    const li = document.createElement("li");
    const link = document.createElement("a");
    const meta = document.createElement("div");
    const title = document.createElement("span");
    const excerpt = document.createElement("p");
    const controls = document.createElement("div");
    const primaryAction = document.createElement("button");
    const secondaryAction = document.createElement("button");
    const action = actionForView(article);
    const canUpdateState = Boolean(article.readerState?.work_id);

    link.href = articleHref(article);
    link.className = "article-card";
    link.addEventListener("click", () => {
      if (state.activeView === "unread") {
        updateArticleState(article, "read", { silent: true });
      }
    });
    meta.className = "article-source";
    meta.textContent = [article.source, article.section, formatDate(article.publishedAt)].filter(Boolean).join(" / ");
    title.className = "article-title";
    title.textContent = article.title;
    excerpt.className = "article-excerpt";
    excerpt.textContent = article.excerpt || "No feed summary available.";
    link.append(meta, title, excerpt);
    li.appendChild(link);
    if (canUpdateState) {
      controls.className = "article-actions";
      primaryAction.type = "button";
      primaryAction.textContent = action.label;
      primaryAction.addEventListener("click", () => updateArticleState(article, action.action));
      secondaryAction.type = "button";
      secondaryAction.textContent = state.activeView === "archived" ? "Archive" : "Dismiss";
      secondaryAction.disabled = state.activeView === "archived";
      secondaryAction.addEventListener("click", () => updateArticleState(article, "dismiss"));
      controls.append(primaryAction, secondaryAction);
      li.appendChild(controls);
    }
    els.list.appendChild(li);
  });
}

async function loadSources() {
  const response = await fetch("/api/sources");
  const payload = await response.json();

  state.sources = payload.sources || [];
  renderSources();
}

async function loadArticles({ refresh = false } = {}) {
  els.status.classList.remove("error");
  els.status.textContent = refresh ? "Refreshing..." : "Loading feed...";
  els.refresh.disabled = true;

  try {
    const params = new URLSearchParams({ view: state.activeView });
    const endpoint = refresh ? "/api/items/refresh" : `/api/items?${params.toString()}`;
    const options = refresh ? { method: "POST" } : {};

    const response = await fetch(refresh ? `${endpoint}?${params.toString()}` : endpoint, options);
    const payload = await response.json();

    if (!response.ok) {
      const blocker = Array.isArray(payload.blockers) ? payload.blockers[0] : null;
      throw new Error(blocker?.message || payload.error || "Unable to load feed.");
    }

    state.articles = payload.items || [];
    els.status.textContent = payload.errors?.length
      ? `${payload.errors.length} source error${payload.errors.length === 1 ? "" : "s"}`
      : `Updated ${formatDate(payload.generatedAt)}`;
    renderArticles();
  } catch (err) {
    els.status.textContent = err instanceof Error ? err.message : String(err);
    els.status.classList.add("error");
  } finally {
    els.refresh.disabled = false;
  }
}

els.refresh.addEventListener("click", () => loadArticles({ refresh: true }));

renderViews();
loadSources();
loadArticles();
