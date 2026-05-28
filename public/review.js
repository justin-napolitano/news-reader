const REVIEW_POSITION_KEY = "news-reader:review-position";

const state = {
  articles: [],
  index: 0,
  chunksById: new Map(),
  chunkIndex: 0,
  lastAction: null,
  drag: null
};

const els = {
  card: document.querySelector("#review-card"),
  source: document.querySelector("#review-source"),
  title: document.querySelector("#review-title"),
  excerpt: document.querySelector("#review-excerpt"),
  chunk: document.querySelector("#review-chunk"),
  chunkCount: document.querySelector("#review-chunk-count"),
  open: document.querySelector("#review-open"),
  position: document.querySelector("#review-position"),
  status: document.querySelector("#review-status"),
  save: document.querySelector("#review-save"),
  archive: document.querySelector("#review-archive"),
  read: document.querySelector("#review-read"),
  undo: document.querySelector("#review-undo")
};

function articleId(article) {
  return article?.readerState?.work_id || article?.id || "";
}

function savePosition() {
  try {
    window.localStorage.setItem(REVIEW_POSITION_KEY, String(state.index));
  } catch (_err) {
    // Review position is an enhancement.
  }
}

function restorePosition() {
  try {
    const value = Number.parseInt(window.localStorage.getItem(REVIEW_POSITION_KEY) || "0", 10);

    return Number.isFinite(value) && value >= 0 ? value : 0;
  } catch (_err) {
    return 0;
  }
}

function setStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.classList.toggle("error", isError);
}

function currentArticle() {
  return state.articles[state.index] || null;
}

function splitChunks(text) {
  return String(text || "")
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 40)
    .slice(0, 80);
}

function renderEmpty(message = "No unread articles.") {
  els.position.textContent = "0 / 0";
  els.source.textContent = "News Reader";
  els.title.textContent = "All clear";
  els.excerpt.textContent = message;
  els.chunk.hidden = true;
  els.chunk.textContent = "";
  els.chunkCount.textContent = "Done";
  els.open.hidden = true;
  els.save.disabled = true;
  els.archive.disabled = true;
  els.read.disabled = true;
}

function renderArticle() {
  const article = currentArticle();

  els.card.style.transform = "";
  els.card.classList.remove("is-saving", "is-archiving");

  if (!article) {
    renderEmpty();
    savePosition();
    return;
  }

  const chunks = state.chunksById.get(articleId(article)) || [];

  els.position.textContent = `${state.index + 1} / ${state.articles.length}`;
  els.source.textContent = [article.source, article.section].filter(Boolean).join(" / ") || "Reader";
  els.title.textContent = article.title || "Untitled";
  els.open.href = article.url;
  els.open.hidden = !article.url;
  els.save.disabled = false;
  els.archive.disabled = false;
  els.read.disabled = false;

  if (chunks.length) {
    els.excerpt.hidden = true;
    els.chunk.hidden = false;
    els.chunk.textContent = chunks[state.chunkIndex] || chunks[0];
    els.chunkCount.textContent = `Paragraph ${state.chunkIndex + 1} / ${chunks.length}`;
    els.read.textContent = state.chunkIndex + 1 >= chunks.length ? "Back to excerpt" : "Next paragraph";
  } else {
    els.excerpt.hidden = false;
    els.chunk.hidden = true;
    els.excerpt.textContent = article.excerpt || "No summary available. Tap Read chunk to extract readable text.";
    els.chunk.textContent = "";
    els.chunkCount.textContent = "Excerpt";
    els.read.textContent = "Read chunk";
  }

  setStatus("Swipe right to save, left to archive.");
  savePosition();
}

async function loadArticles() {
  try {
    const response = await fetch("/api/items?view=unread");
    const payload = await response.json();

    if (!response.ok || payload.ok === false) {
      const blocker = Array.isArray(payload.blockers) ? payload.blockers[0] : null;
      throw new Error(blocker?.message || payload.error || "Unable to load unread articles.");
    }

    state.articles = payload.items || [];
    state.index = Math.min(restorePosition(), Math.max(0, state.articles.length - 1));
    renderArticle();
  } catch (err) {
    renderEmpty("The review deck could not load.");
    setStatus(err instanceof Error ? err.message : String(err), true);
  }
}

async function loadChunks(article) {
  const id = articleId(article);

  if (!article?.url || !id) {
    return [];
  }
  if (state.chunksById.has(id)) {
    return state.chunksById.get(id);
  }

  setStatus("Extracting readable text...");
  const response = await fetch(`/api/read?url=${encodeURIComponent(article.url)}`);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Unable to extract readable text.");
  }

  const chunks = splitChunks(payload.text || article.excerpt || "");

  state.chunksById.set(id, chunks);
  return chunks;
}

async function nextChunk() {
  const article = currentArticle();

  if (!article) {
    return;
  }

  try {
    const hadChunks = state.chunksById.has(articleId(article));
    const chunks = await loadChunks(article);

    if (!chunks.length) {
      setStatus("No readable paragraph extracted.", true);
      return;
    }

    state.chunkIndex = hadChunks ? (state.chunkIndex + 1) % chunks.length : 0;
    renderArticle();
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), true);
  }
}

function advance() {
  state.index = Math.min(state.index + 1, state.articles.length);
  state.chunkIndex = 0;
  renderArticle();
}

async function applyAction(action) {
  const article = currentArticle();
  const id = articleId(article);

  if (!article || !id) {
    return;
  }

  const undoAction = action === "save" ? "unsave" : "restore";
  state.lastAction = { article, index: state.index, undoAction };
  els.undo.disabled = false;
  setStatus(action === "save" ? "Saving..." : "Archiving...");

  try {
    const response = await fetch("/api/life-graph/intel/reader/state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ work_id: id, action })
    });
    const payload = await response.json();

    if (!response.ok || payload.ok === false) {
      const blocker = Array.isArray(payload.blockers) ? payload.blockers[0] : null;
      throw new Error(blocker?.message || payload.error || "Unable to update reader state.");
    }

    state.articles.splice(state.index, 1);
    if (state.index >= state.articles.length) {
      state.index = Math.max(0, state.articles.length - 1);
    }
    state.chunkIndex = 0;
    renderArticle();
  } catch (err) {
    state.lastAction = null;
    els.undo.disabled = true;
    setStatus(err instanceof Error ? err.message : String(err), true);
  }
}

async function undoLast() {
  if (!state.lastAction) {
    return;
  }

  const { article, index, undoAction } = state.lastAction;
  const id = articleId(article);

  els.undo.disabled = true;
  setStatus("Undoing...");

  try {
    const response = await fetch("/api/life-graph/intel/reader/state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ work_id: id, action: undoAction })
    });
    const payload = await response.json();

    if (!response.ok || payload.ok === false) {
      const blocker = Array.isArray(payload.blockers) ? payload.blockers[0] : null;
      throw new Error(blocker?.message || payload.error || "Unable to undo action.");
    }

    state.articles.splice(Math.min(index, state.articles.length), 0, article);
    state.index = Math.min(index, state.articles.length - 1);
    state.lastAction = null;
    state.chunkIndex = 0;
    renderArticle();
  } catch (err) {
    els.undo.disabled = false;
    setStatus(err instanceof Error ? err.message : String(err), true);
  }
}

function pointerX(event) {
  return event.clientX ?? event.touches?.[0]?.clientX ?? 0;
}

function pointerY(event) {
  return event.clientY ?? event.touches?.[0]?.clientY ?? 0;
}

function onPointerDown(event) {
  state.drag = {
    x: pointerX(event),
    y: pointerY(event),
    pointerId: event.pointerId
  };
  els.card.setPointerCapture?.(event.pointerId);
}

function onPointerMove(event) {
  if (!state.drag) {
    return;
  }

  const dx = pointerX(event) - state.drag.x;
  const dy = pointerY(event) - state.drag.y;
  const rotate = Math.max(-10, Math.min(10, dx / 18));

  els.card.style.transform = `translate(${dx}px, ${dy * 0.15}px) rotate(${rotate}deg)`;
  els.card.classList.toggle("is-saving", dx > 60);
  els.card.classList.toggle("is-archiving", dx < -60);
}

function onPointerUp(event) {
  if (!state.drag) {
    return;
  }

  const dx = pointerX(event) - state.drag.x;
  const dy = pointerY(event) - state.drag.y;

  state.drag = null;
  els.card.releasePointerCapture?.(event.pointerId);
  els.card.style.transform = "";
  els.card.classList.remove("is-saving", "is-archiving");

  if (dx > 90 && Math.abs(dx) > Math.abs(dy)) {
    applyAction("save");
  } else if (dx < -90 && Math.abs(dx) > Math.abs(dy)) {
    applyAction("dismiss");
  } else if (dy < -90) {
    nextChunk();
  }
}

els.save.addEventListener("click", () => applyAction("save"));
els.archive.addEventListener("click", () => applyAction("dismiss"));
els.read.addEventListener("click", nextChunk);
els.chunk.addEventListener("click", nextChunk);
els.excerpt.addEventListener("click", nextChunk);
els.undo.addEventListener("click", undoLast);
els.card.addEventListener("pointerdown", onPointerDown);
els.card.addEventListener("pointermove", onPointerMove);
els.card.addEventListener("pointerup", onPointerUp);
els.card.addEventListener("pointercancel", onPointerUp);
window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight") {
    applyAction("save");
  } else if (event.key === "ArrowLeft") {
    applyAction("dismiss");
  } else if (event.key === "ArrowUp" || event.key === " ") {
    event.preventDefault();
    nextChunk();
  } else if (event.key.toLowerCase() === "u") {
    undoLast();
  }
});

loadArticles();
