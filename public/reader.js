const params = new URLSearchParams(window.location.search);
const articleUrl = params.get("url");
const fallbackTitle = params.get("title") || "Untitled";
const fallbackSource = [params.get("source"), params.get("section")].filter(Boolean).join(" / ");

const els = {
  source: document.querySelector("#reader-source"),
  title: document.querySelector("#reader-title"),
  link: document.querySelector("#reader-link"),
  body: document.querySelector("#reader-body")
};

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
  els.title.textContent = fallbackTitle;
  els.source.textContent = fallbackSource || "Reader";

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

loadReader();
