const state = {
  articles: [],
  sources: [],
  activeSource: "all"
};

const els = {
  sourceStrip: document.querySelector("#public-source-strip"),
  status: document.querySelector("#public-status"),
  count: document.querySelector("#public-count"),
  list: document.querySelector("#public-article-list")
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

  return state.articles.filter((article) => article.sourceKey === state.activeSource);
}

function renderSources() {
  const sources = [
    { id: "all", name: "All", count: state.articles.length },
    ...state.sources
  ];

  els.sourceStrip.innerHTML = "";
  sources.forEach((source) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = `source-filter${state.activeSource === source.id ? " is-active" : ""}`;
    button.textContent = `${source.name}${source.count ? ` ${source.count}` : ""}`;
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

  els.count.textContent = `${articles.length} item${articles.length === 1 ? "" : "s"}`;
  els.list.innerHTML = "";

  if (!articles.length) {
    const li = document.createElement("li");
    const p = document.createElement("p");

    p.className = "public-empty-state";
    p.textContent = "No public reader items are available for this source.";
    li.appendChild(p);
    els.list.appendChild(li);
    return;
  }

  articles.forEach((article) => {
    const li = document.createElement("li");
    const link = document.createElement("a");
    const meta = document.createElement("div");
    const title = document.createElement("span");
    const excerpt = document.createElement("p");

    link.href = article.url || "#";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "article-card";
    meta.className = "article-source";
    meta.textContent = [article.source, article.section, formatDate(article.publishedAt)]
      .filter(Boolean)
      .join(" / ");
    title.className = "article-title";
    title.textContent = article.title || "Untitled";
    excerpt.className = "article-excerpt";
    excerpt.textContent = article.excerpt || "No feed summary available.";
    link.append(meta, title, excerpt);
    li.appendChild(link);
    els.list.appendChild(li);
  });
}

async function loadPublicArticles() {
  els.status.classList.remove("error");
  els.status.textContent = "Loading reader graph...";

  try {
    const response = await fetch("/api/public/articles");
    const payload = await response.json();
    const data = payload.data || {};

    if (!response.ok || !payload.ok) {
      const blocker = payload.blockers?.[0];
      throw new Error(blocker?.message || payload.error || "Unable to load the public reader graph.");
    }

    state.articles = Array.isArray(data.items) ? data.items : [];
    state.sources = Array.isArray(data.sources) ? data.sources : [];
    els.status.textContent = data.errors?.length
      ? `${data.errors.length} source issue${data.errors.length === 1 ? "" : "s"}`
      : `Updated ${formatDate(data.generatedAt)}`;
    renderSources();
    renderArticles();
  } catch (err) {
    els.status.textContent = err instanceof Error ? err.message : String(err);
    els.status.classList.add("error");
    renderSources();
    renderArticles();
  }
}

loadPublicArticles();
