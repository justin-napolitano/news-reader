const LIST_CONTEXT_KEY = "news-reader:list-context";
const params = new URLSearchParams(window.location.search);
const articleUrl = params.get("url");
const workId = params.get("work_id") || params.get("id") || "";
const fallbackTitle = params.get("title") || "Untitled";
const fallbackSource = [params.get("source"), params.get("section")].filter(Boolean).join(" / ");
const currentIndex = Number.parseInt(params.get("index") || "", 10);
const readerState = {
  isSaved: params.get("saved") === "1",
  isArchived: params.get("archived") === "1"
};

const els = {
  back: document.querySelector("#reader-back"),
  source: document.querySelector("#reader-source"),
  title: document.querySelector("#reader-title"),
  link: document.querySelector("#reader-link"),
  body: document.querySelector("#reader-body"),
  save: document.querySelector("#reader-save"),
  archive: document.querySelector("#reader-archive"),
  status: document.querySelector("#reader-action-status")
};

function readListContext() {
  try {
    return JSON.parse(window.sessionStorage.getItem(LIST_CONTEXT_KEY) || "null");
  } catch (_err) {
    return null;
  }
}

function safeSameOriginPath(value, fallback = "/") {
  if (!value) {
    return fallback;
  }

  try {
    const parsed = new URL(value, window.location.origin);

    if (parsed.origin !== window.location.origin) {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch (_err) {
    return fallback;
  }
}

function safeReaderPath(value) {
  const path = safeSameOriginPath(value, "");
  return path.startsWith("/reader.html?") ? path : "";
}

const listContext = readListContext();
const returnPath = safeSameOriginPath(params.get("return") || listContext?.returnPath, "/");

function setActionStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.classList.toggle("error", isError);
}

function successMessage(action) {
  if (action === "save") {
    return "Saved.";
  }

  if (action === "unsave") {
    return "Removed from saved.";
  }

  if (action === "dismiss") {
    return "Archived.";
  }

  return "Updated.";
}

function progressMessage(action) {
  if (action === "dismiss") {
    return "Archiving...";
  }

  return action === "unsave" ? "Removing..." : "Saving...";
}

function nextArticleHref() {
  if (!Number.isInteger(currentIndex) || currentIndex < 0 || !Array.isArray(listContext?.articles)) {
    return "";
  }

  return safeReaderPath(listContext.articles[currentIndex + 1]?.href);
}

function advanceToNextArticle(action) {
  const href = nextArticleHref();

  if (!href) {
    return false;
  }

  setActionStatus(`${successMessage(action)} Opening next article...`);
  window.setTimeout(() => {
    window.location.replace(href);
  }, 120);
  return true;
}

function renderReaderActions() {
  const canUpdateState = Boolean(workId);

  els.save.hidden = !canUpdateState;
  els.archive.hidden = !canUpdateState;
  els.save.disabled = !canUpdateState;
  els.archive.disabled = !canUpdateState || readerState.isArchived;
  els.save.textContent = readerState.isSaved ? "Saved" : "Save";
  els.archive.textContent = readerState.isArchived ? "Archived" : "Archive";
  els.save.setAttribute("aria-pressed", readerState.isSaved ? "true" : "false");
  els.archive.setAttribute("aria-pressed", readerState.isArchived ? "true" : "false");

  if (!canUpdateState) {
    setActionStatus("");
  }
}

async function updateReaderState(action) {
  if (!workId) {
    return;
  }

  const previousState = { ...readerState };
  let advancing = false;

  els.save.disabled = true;
  els.archive.disabled = true;
  setActionStatus(progressMessage(action));

  try {
    const response = await fetch("/api/life-graph/intel/reader/state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ work_id: workId, action })
    });
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      const blocker = payload.blockers?.[0];
      throw new Error(blocker?.message || payload.error || "Unable to update reader state.");
    }

    if (action === "save") {
      readerState.isSaved = true;
    } else if (action === "unsave") {
      readerState.isSaved = false;
    } else if (action === "dismiss") {
      readerState.isArchived = true;
    }

    advancing = advanceToNextArticle(action);

    if (!advancing) {
      setActionStatus(successMessage(action));
    }
  } catch (err) {
    readerState.isSaved = previousState.isSaved;
    readerState.isArchived = previousState.isArchived;
    setActionStatus(err instanceof Error ? err.message : String(err), true);
  } finally {
    if (!advancing) {
      renderReaderActions();
    }
  }
}

function renderParagraphs(text) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  els.body.innerHTML = "";
  paragraphs.forEach((paragraph) => {
    const p = document.createElement("p");

    p.textContent = paragraph;
    els.body.appendChild(p);
  });
}

function renderError(message) {
  els.body.innerHTML = "";
  const p = document.createElement("p");

  p.className = "error";
  p.textContent = message;
  els.body.appendChild(p);
}

async function loadReader() {
  els.back.href = returnPath;
  els.title.textContent = fallbackTitle;
  els.source.textContent = fallbackSource || "Reader";
  renderReaderActions();

  if (!articleUrl) {
    els.link.hidden = true;
    renderError("Missing article URL.");
    return;
  }

  els.link.href = articleUrl;

  try {
    const response = await fetch(`/api/read?url=${encodeURIComponent(articleUrl)}`);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Unable to extract readable text.");
    }

    els.title.textContent = payload.title || fallbackTitle;
    renderParagraphs(payload.text || "No readable text extracted. Open the original source.");
  } catch (err) {
    renderError(err instanceof Error ? err.message : String(err));
  }
}

els.save.addEventListener("click", () => updateReaderState(readerState.isSaved ? "unsave" : "save"));
els.archive.addEventListener("click", () => updateReaderState("dismiss"));

loadReader();
