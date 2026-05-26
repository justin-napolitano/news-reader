const state = {
  articles: [],
  sources: [],
  activeSource: "all",
  activeId: null
};

const els = {
  refresh: document.querySelector("#refresh-button"),
  sourceStrip: document.querySelector("#source-strip"),
  status: document.querySelector("#feed-status"),
  count: document.querySelector("#feed-count"),
  list: document.querySelector("#article-list"),
  empty: document.querySelector("#reader-empty"),
  content: document.querySelector("#reader-content"),
  readerSource: document.querySelector("#reader-source"),
  readerTitle: document.querySelector("#reader-title"),
  readerLink: document.querySelector("#reader-link"),
  readerBody: document.querySelector("#reader-body")
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
    const button = document.createElement("button");
    const meta = document.createElement("div");
    const title = document.createElement("span");
    const excerpt = document.createElement("p");

    button.type = "button";
    button.className = `article-card${state.activeId === article.id ? " is-active" : ""}`;
    meta.className = "article-source";
    meta.textContent = [article.source, article.section, formatDate(article.publishedAt)].filter(Boolean).join(" / ");
    title.className = "article-title";
    title.textContent = article.title;
    excerpt.className = "article-excerpt";
    excerpt.textContent = article.excerpt || "No feed summary available.";
    button.append(meta, title, excerpt);
    button.addEventListener("click", () => openArticle(article));
    li.appendChild(button);
    els.list.appendChild(li);
  });
}

function setReaderLoading(article) {
  state.activeId = article.id;
  renderArticles();
  els.empty.hidden = true;
  els.content.hidden = false;
  els.readerSource.textContent = [article.source, article.section].filter(Boolean).join(" / ");
  els.readerTitle.textContent = article.title;
  els.readerLink.href = article.url;
  els.readerBody.innerHTML = "<p>Extracting readable text...</p>";
}

function renderReaderText(text) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  els.readerBody.innerHTML = "";
  paragraphs.forEach((paragraph) => {
    const p = document.createElement("p");

    p.textContent = paragraph;
    els.readerBody.appendChild(p);
  });
}

async function openArticle(article) {
  setReaderLoading(article);

  try {
    const response = await fetch(`/api/read?url=${encodeURIComponent(article.url)}`);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Unable to read article.");
    }

    els.readerTitle.textContent = payload.title || article.title;
    renderReaderText(payload.text || article.excerpt || "No readable text extracted. Open the original source.");
  } catch (err) {
    els.readerBody.innerHTML = "";
    const p = document.createElement("p");

    p.className = "error";
    p.textContent = err instanceof Error ? err.message : String(err);
    els.readerBody.appendChild(p);

    if (article.excerpt) {
      const fallback = document.createElement("p");

      fallback.textContent = article.excerpt;
      els.readerBody.appendChild(fallback);
    }
  }
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
