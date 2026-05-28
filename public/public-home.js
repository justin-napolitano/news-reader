const els = {
  source: document.querySelector("#public-source"),
  title: document.querySelector("#public-title"),
  meta: document.querySelector("#public-meta"),
  body: document.querySelector("#public-body"),
  link: document.querySelector("#public-link")
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

function renderMessage(message, isError = false) {
  els.body.innerHTML = "";
  const p = document.createElement("p");

  p.textContent = message;
  p.className = isError ? "error" : "";
  els.body.appendChild(p);
}

function renderExcerpt(value) {
  const text = String(value || "").trim();

  if (!text) {
    renderMessage("No feed summary is available. Open the original source to read more.");
    return;
  }

  els.body.innerHTML = "";
  const p = document.createElement("p");

  p.textContent = text;
  els.body.appendChild(p);
}

async function loadCurrentArticle() {
  try {
    const response = await fetch("/api/public/current-article");
    const payload = await response.json();
    const data = payload.data || {};
    const item = data.item;

    if (!response.ok || !payload.ok) {
      const blocker = payload.blockers?.[0];
      throw new Error(blocker?.message || payload.error || "Unable to load the current article.");
    }

    if (!item) {
      els.source.textContent = "Reader";
      els.title.textContent = "No current article";
      els.meta.textContent = "";
      els.link.hidden = true;
      renderMessage("The reader does not have a public item available right now.");
      return;
    }

    els.source.textContent = [item.source, item.section].filter(Boolean).join(" / ") || "Reader";
    els.title.textContent = item.title || "Untitled";
    els.meta.textContent = [formatDate(item.publishedAt), data.view].filter(Boolean).join(" / ");
    els.link.href = item.url;
    els.link.hidden = !item.url;
    renderExcerpt(item.excerpt);
  } catch (err) {
    els.source.textContent = "Reader";
    els.title.textContent = "Reader unavailable";
    els.meta.textContent = "";
    els.link.hidden = true;
    renderMessage(err instanceof Error ? err.message : String(err), true);
  }
}

loadCurrentArticle();
