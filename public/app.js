const state = {
  articles: [],
  sources: [],
  activeSource: "all"
};

const els = {
  refresh: document.querySelector("#refresh-button"),
  sourceStrip: document.querySelector("#source-strip"),
  status: document.querySelector("#feed-status"),
  count: document.querySelector("#feed-count"),
  list: document.querySelector("#article-list")
};

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

  return `/reader.html?${params.toString()}`;
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

    link.href = articleHref(article);
    link.className = "article-card";
    meta.className = "article-source";
    meta.textContent = [article.source, article.section, formatDate(article.publishedAt)].filter(Boolean).join(" / ");
    title.className = "article-title";
    title.textContent = article.title;
    excerpt.className = "article-excerpt";
    excerpt.textContent = article.excerpt || "No feed summary available.";
    link.append(meta, title, excerpt);
    li.appendChild(link);
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
  els.status.textContent = refresh ? "Refreshing..." : "Loading feed...";

  try {
    const response = await fetch(`/api/items${refresh ? "?refresh=1" : ""}`);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Unable to load feed.");
    }

    state.articles = payload.items || [];
    els.status.textContent = payload.errors?.length
      ? `${payload.errors.length} source error${payload.errors.length === 1 ? "" : "s"}`
      : `Updated ${formatDate(payload.generatedAt)}`;
    renderArticles();
  } catch (err) {
    els.status.textContent = err instanceof Error ? err.message : String(err);
    els.status.classList.add("error");
  }
}

els.refresh.addEventListener("click", () => loadArticles({ refresh: true }));

loadSources();
loadArticles();
