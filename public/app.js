const LIST_CONTEXT_KEY = "news-reader:list-context";
const RELEVANCE_KEY = "news-reader:relevance-controls";

const state = {
  articles: [],
  sources: [],
  activeSource: "all",
  activeView: "unread",
  restoredScroll: false
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

const initialParams = new URLSearchParams(window.location.search);

state.activeView = normalizeView(initialParams.get("view"));
state.activeSource = initialParams.get("source") || "all";

function normalizeView(value) {
  return views.some((view) => view.id === value) ? value : "unread";
}

function normalizeLoadedSource(value) {
  if (!value || value === "all") {
    return "all";
  }

  return state.sources.some((source) => source.id === value) ? value : "all";
}

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
  const controls = loadRelevanceControls();
  const sourceFiltered =
    state.activeSource === "all"
      ? state.articles
      : state.articles.filter((article) => article.sourceId === state.activeSource);

  return sourceFiltered
    .map((article, index) => ({ ...article, relevance: relevanceForArticle(article, controls), originalIndex: index }))
    .filter((article) => !article.relevance.hidden)
    .sort((left, right) => {
      if (right.relevance.score !== left.relevance.score) {
        return right.relevance.score - left.relevance.score;
      }

      return left.originalIndex - right.originalIndex;
    });
}

function loadRelevanceControls() {
  try {
    const controls = JSON.parse(window.localStorage.getItem(RELEVANCE_KEY) || "{}");

    return {
      priorityTerms: normalizeTerms(controls.priorityTerms),
      hiddenTerms: normalizeTerms(controls.hiddenTerms),
      prioritySources: normalizeTerms(controls.prioritySources)
    };
  } catch (_err) {
    return { priorityTerms: [], hiddenTerms: [], prioritySources: [] };
  }
}

async function loadRemoteRelevanceControls() {
  try {
    const response = await fetch("/api/life-graph/intel/reader/preferences");
    const payload = await response.json();
    const preferences = payload.data?.preferences;

    if (response.ok && payload.ok !== false && preferences) {
      window.localStorage.setItem(
        RELEVANCE_KEY,
        JSON.stringify({
          version: 1,
          priorityTerms: preferences.priority_terms || [],
          hiddenTerms: preferences.hidden_terms || [],
          prioritySources: preferences.priority_sources || []
        })
      );
    }
  } catch (_err) {
    // Browser-local relevance remains available when Life Graph is offline.
  }
}

function normalizeTerms(value) {
  return Array.isArray(value)
    ? value.map((term) => String(term).trim().toLowerCase()).filter(Boolean)
    : [];
}

function articleText(article) {
  return [article.title, article.excerpt, article.source, article.section].filter(Boolean).join(" ").toLowerCase();
}

function matchedTerms(text, terms) {
  return terms.filter((term) => text.includes(term)).slice(0, 4);
}

function sourceMatches(article, prioritySources) {
  const sourceText = [article.sourceId, article.source].filter(Boolean).join(" ").toLowerCase();

  return prioritySources.filter((source) => sourceText.includes(source)).slice(0, 2);
}

function relevanceForArticle(article, controls) {
  const text = articleText(article);
  const hiddenMatches = matchedTerms(text, controls.hiddenTerms);

  if (hiddenMatches.length) {
    return {
      hidden: true,
      score: -100,
      reasons: [`Hidden term: ${hiddenMatches.join(", ")}`]
    };
  }

  const priorityMatches = matchedTerms(text, controls.priorityTerms);
  const sourcePriorityMatches = sourceMatches(article, controls.prioritySources);
  const score = priorityMatches.length * 3 + sourcePriorityMatches.length * 2;
  const reasons = [];

  if (priorityMatches.length) {
    reasons.push(`Matches: ${priorityMatches.join(", ")}`);
  }
  if (sourcePriorityMatches.length) {
    reasons.push(`Priority source: ${article.source}`);
  }
  if (!reasons.length) {
    reasons.push([article.source, article.section].filter(Boolean).join(" / "));
  }

  return { hidden: false, score, reasons };
}

function currentListPath() {
  const params = new URLSearchParams();

  if (state.activeView !== "unread") {
    params.set("view", state.activeView);
  }

  if (state.activeSource !== "all") {
    params.set("source", state.activeSource);
  }

  const query = params.toString();
  return query ? `/?${query}` : "/";
}

function syncListUrl() {
  window.history.replaceState(null, "", currentListPath());
}

function readListContext() {
  try {
    return JSON.parse(window.sessionStorage.getItem(LIST_CONTEXT_KEY) || "null");
  } catch (_err) {
    return null;
  }
}

function listContextMatches(context) {
  return context?.view === state.activeView && context?.source === state.activeSource;
}

function saveListContext() {
  const articles = filteredArticles().map((article, index) => ({
    id: article.readerState?.work_id || article.id,
    href: articleHref(article, index)
  }));

  try {
    window.sessionStorage.setItem(
      LIST_CONTEXT_KEY,
      JSON.stringify({
        version: 1,
        savedAt: new Date().toISOString(),
        view: state.activeView,
        source: state.activeSource,
        returnPath: currentListPath(),
        scrollY: window.scrollY,
        articles
      })
    );
  } catch (_err) {
    // Session storage is an enhancement; links still carry the return filters.
  }
}

function restoreListScroll() {
  if (state.restoredScroll) {
    return false;
  }

  const context = readListContext();

  if (!listContextMatches(context) || !Number.isFinite(context.scrollY)) {
    state.restoredScroll = true;
    return false;
  }

  state.restoredScroll = true;
  window.requestAnimationFrame(() => {
    window.scrollTo(0, context.scrollY);
    saveListContext();
  });
  return true;
}

function resetScrollMemory() {
  state.restoredScroll = true;
  window.scrollTo(0, 0);
}

function articleHref(article, index = -1) {
  const params = new URLSearchParams({
    url: article.url,
    title: article.title,
    source: article.source,
    section: article.section || "",
    view: state.activeView,
    source_filter: state.activeSource,
    return: currentListPath()
  });

  const workId = article.readerState?.work_id || article.id;

  if (workId) {
    params.set("work_id", workId);
  }

  if (article.readerState) {
    params.set("saved", article.readerState.is_saved ? "1" : "0");
    params.set("archived", article.readerState.is_hidden ? "1" : "0");
  }

  if (index >= 0) {
    params.set("index", String(index));
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
      resetScrollMemory();
      syncListUrl();
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
      resetScrollMemory();
      syncListUrl();
      renderSources();
      renderArticles();
      saveListContext();
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

  articles.forEach((article, index) => {
    const li = document.createElement("li");
    const link = document.createElement("a");
    const meta = document.createElement("div");
    const title = document.createElement("span");
    const excerpt = document.createElement("p");
    const why = document.createElement("div");
    const controls = document.createElement("div");
    const primaryAction = document.createElement("button");
    const secondaryAction = document.createElement("button");
    const action = actionForView(article);
    const canUpdateState = Boolean(article.readerState?.work_id);

    link.href = articleHref(article, index);
    link.className = "article-card";
    link.addEventListener("click", () => {
      saveListContext();
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
    why.className = "article-why";
    why.textContent = `Why: ${article.relevance.reasons.join(" / ")}`;
    link.append(meta, title, excerpt, why);
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
  const requestedSource = state.activeSource;
  state.activeSource = normalizeLoadedSource(state.activeSource);
  syncListUrl();
  renderSources();

  if (requestedSource !== state.activeSource) {
    renderArticles();
    saveListContext();
  }
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
    if (!restoreListScroll()) {
      saveListContext();
    }
  } catch (err) {
    els.status.textContent = err instanceof Error ? err.message : String(err);
    els.status.classList.add("error");
  } finally {
    els.refresh.disabled = false;
  }
}

els.refresh.addEventListener("click", () => loadArticles({ refresh: true }));
window.addEventListener("pagehide", saveListContext);

renderViews();
syncListUrl();
loadRemoteRelevanceControls().finally(() => {
  loadSources();
  loadArticles();
});
