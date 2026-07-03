/* Flux Énergie — logique client */

const CATS = {
  nucleaire: "Nucléaire",
  renouvelables: "Renouvelables",
  petrole: "Pétrole & gaz",
  geopolitique: "Géopolitique",
};

const state = {
  tab: "intl",            // intl | fr | saved
  cat: "all",
  articles: load("articles", []),   // {id, tab, cat, title, source, date, summary, url, later, important}
};

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function persist() {
  localStorage.setItem("articles", JSON.stringify(state.articles));
}

const feed = document.getElementById("feed");
const emptyState = document.getElementById("emptyState");
const refreshBtn = document.getElementById("refreshBtn");
const classifyBtn = document.getElementById("classifyBtn");
const pasteInput = document.getElementById("pasteInput");
const toast = document.getElementById("toast");

/* ---------- Rendu ---------- */
function render() {
  feed.querySelectorAll(".card, .skeleton").forEach(el => el.remove());

  let items = state.articles.filter(a => {
    if (state.tab === "saved") return a.later || a.important;
    return a.tab === state.tab;
  });
  if (state.cat !== "all") items = items.filter(a => a.cat === state.cat);
  items.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  emptyState.style.display = items.length ? "none" : "block";
  if (!items.length && state.tab === "saved") {
    emptyState.querySelector(".empty-title").textContent = "Rien de sauvegardé.";
    emptyState.querySelector("p:last-child").innerHTML =
      "Marque un article <strong>À lire</strong> ou <strong>Important</strong> pour le retrouver ici.";
  } else if (!items.length) {
    emptyState.querySelector(".empty-title").textContent = "Le flux est vide.";
    emptyState.querySelector("p:last-child").innerHTML =
      "Appuie sur <strong>Actualiser</strong> pour lancer la veille, ou colle un lien ci-dessous.";
  }

  for (const a of items) feed.appendChild(cardEl(a));
}

function cardEl(a) {
  const el = document.createElement("article");
  el.className = "card";
  el.dataset.cat = a.cat;

  const safeTitle = esc(a.title);
  const titleHtml = a.url
    ? `<a href="${esc(a.url)}" target="_blank" rel="noopener">${safeTitle}</a>`
    : safeTitle;

  el.innerHTML = `
    ${a.important ? `<span class="badge-important" aria-label="Important">★</span>` : ""}
    <div class="card-meta">
      <span class="cat-label">${CATS[a.cat] || "Énergie"}</span>
      <span>·</span><span>${esc(a.source || "Source inconnue")}</span>
      ${a.date ? `<span>·</span><span>${esc(a.date)}</span>` : ""}
    </div>
    <h2>${titleHtml}</h2>
    ${a.summary ? `<p class="summary">${esc(a.summary)}</p>` : ""}
    <div class="card-actions">
      <button class="act ${a.later ? "on-later" : ""}" data-act="later">À lire</button>
      <button class="act ${a.important ? "on-important" : ""}" data-act="important">Important</button>
      <button class="act" data-act="delete" aria-label="Supprimer">✕</button>
      ${a.url ? `<a class="link-out" href="${esc(a.url)}" target="_blank" rel="noopener">Lire →</a>` : ""}
    </div>`;

  el.querySelectorAll(".act").forEach(btn => {
    btn.addEventListener("click", () => {
      const act = btn.dataset.act;
      if (act === "delete") {
        state.articles = state.articles.filter(x => x.id !== a.id);
      } else {
        a[act] = !a[act];
      }
      persist();
      render();
    });
  });
  return el;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 2600);
}

/* ---------- Navigation ---------- */
document.querySelectorAll(".tab").forEach(t => {
  t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x => {
      x.classList.toggle("active", x === t);
      x.setAttribute("aria-selected", x === t);
    });
    state.tab = t.dataset.tab;
    render();
  });
});

document.querySelectorAll(".chip").forEach(c => {
  c.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach(x => x.classList.toggle("active", x === c));
    state.cat = c.dataset.cat;
    render();
  });
});

/* ---------- Actualiser (recherche web via fonction serverless) ---------- */
refreshBtn.addEventListener("click", async () => {
  refreshBtn.disabled = true;
  refreshBtn.classList.add("loading");
  showSkeletons();
  try {
    const scope = state.tab === "fr" ? "fr" : "intl";
    const res = await fetch("/api/news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "refresh", scope, category: state.cat }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.articles)) throw new Error("Réponse inattendue");

    let added = 0;
    for (const art of data.articles) {
      if (!art.title) continue;
      const exists = state.articles.some(x =>
        (art.url && x.url === art.url) || x.title === art.title);
      if (exists) continue;
      state.articles.push({
        id: crypto.randomUUID(),
        tab: art.tab === "fr" ? "fr" : "intl",
        cat: CATS[art.cat] ? art.cat : "geopolitique",
        title: art.title,
        source: art.source || "",
        date: art.date || new Date().toISOString().slice(0, 10),
        summary: art.summary || "",
        url: art.url || "",
        later: false,
        important: false,
      });
      added++;
    }
    persist();
    render();
    showToast(added ? `${added} article${added > 1 ? "s" : ""} ajouté${added > 1 ? "s" : ""}` : "Rien de nouveau");
  } catch (e) {
    render();
    showToast("Échec de l'actualisation — vérifie le déploiement de /api/news");
    console.error(e);
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.classList.remove("loading");
  }
});

function showSkeletons() {
  feed.querySelectorAll(".card").forEach(el => el.remove());
  emptyState.style.display = "none";
  for (let i = 0; i < 4; i++) {
    const sk = document.createElement("div");
    sk.className = "skeleton";
    feed.appendChild(sk);
  }
}

/* ---------- Classer un lien / extrait collé ---------- */
classifyBtn.addEventListener("click", async () => {
  const text = pasteInput.value.trim();
  if (!text) return;
  classifyBtn.disabled = true;
  classifyBtn.textContent = "…";
  try {
    const res = await fetch("/api/news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "classify", text }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const art = (await res.json()).article;
    if (!art || !art.title) throw new Error("Classification impossible");
    state.articles.push({
      id: crypto.randomUUID(),
      tab: art.tab === "fr" ? "fr" : "intl",
      cat: CATS[art.cat] ? art.cat : "geopolitique",
      title: art.title,
      source: art.source || "",
      date: art.date || new Date().toISOString().slice(0, 10),
      summary: art.summary || "",
      url: art.url || (text.startsWith("http") ? text.split(/\s/)[0] : ""),
      later: false,
      important: false,
    });
    persist();
    pasteInput.value = "";
    // bascule sur l'onglet où l'article a été rangé
    const target = art.tab === "fr" ? "fr" : "intl";
    document.querySelector(`.tab[data-tab="${target}"]`).click();
    showToast(`Classé : ${CATS[art.cat] || "Énergie"}`);
  } catch (e) {
    showToast("Impossible de classer — réessaie");
    console.error(e);
  } finally {
    classifyBtn.disabled = false;
    classifyBtn.textContent = "Classer";
  }
});

/* ---------- Service worker ---------- */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

render();

/* ================= SYNTHÈSE ================= */
const synthPanel = document.getElementById("synthPanel");
const synthContent = document.getElementById("synthContent");
const synthBtn = document.getElementById("synthBtn");

synthBtn.addEventListener("click", async () => {
  // Articles actuellement visibles (onglet + filtre)
  let items = state.articles.filter(a => {
    if (state.tab === "saved") return a.later || a.important;
    return a.tab === state.tab;
  });
  if (state.cat !== "all") items = items.filter(a => a.cat === state.cat);

  if (!items.length) {
    showToast("Aucun article à synthétiser — actualise d'abord le flux");
    return;
  }

  synthPanel.hidden = false;
  synthContent.innerHTML = `<p class="synth-loading">Rédaction du point d'actualité (${items.length} articles)…</p>`;
  synthBtn.disabled = true;

  try {
    const res = await fetch("/api/news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "synthesize",
        articles: items.slice(0, 25).map(a => ({
          title: a.title, source: a.source, date: a.date,
          summary: a.summary, cat: a.cat,
        })),
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    synthContent.innerHTML = mdLite(data.synthesis || "Synthèse indisponible.");
  } catch (e) {
    synthContent.innerHTML = `<p class="synth-loading">Échec de la synthèse — réessaie.</p>`;
    console.error(e);
  } finally {
    synthBtn.disabled = false;
  }
});

document.getElementById("synthClose").addEventListener("click", () => {
  synthPanel.hidden = true;
});

/* ================= QUESTIONS / RÉPONSES ================= */
const askPanel = document.getElementById("askPanel");
const askThread = document.getElementById("askThread");
const askInput = document.getElementById("askInput");
const askSend = document.getElementById("askSend");
const chatHistory = []; // {role, content} — mémoire de session uniquement

document.getElementById("askOpenBtn").addEventListener("click", () => {
  askPanel.hidden = false;
  askInput.focus();
});
document.getElementById("askClose").addEventListener("click", () => {
  askPanel.hidden = true;
});

askSend.addEventListener("click", sendQuestion);
askInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendQuestion(); }
});

async function sendQuestion() {
  const q = askInput.value.trim();
  if (!q) return;
  askInput.value = "";
  addMsg("user", q);
  chatHistory.push({ role: "user", content: q });

  const thinking = addMsg("bot thinking", "Recherche en cours…");
  askSend.disabled = true;

  try {
    // Contexte : les 15 articles les plus récents du flux
    const ctx = [...state.articles]
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .slice(0, 15)
      .map(a => ({ title: a.title, source: a.source, date: a.date, summary: a.summary, cat: a.cat }));

    const res = await fetch("/api/news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "ask",
        history: chatHistory.slice(-8), // 4 derniers échanges
        context: ctx,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const answer = data.answer || "Je n'ai pas pu répondre — réessaie.";
    thinking.classList.remove("thinking");
    thinking.textContent = answer;
    chatHistory.push({ role: "assistant", content: answer });
  } catch (e) {
    thinking.classList.remove("thinking");
    thinking.textContent = "Erreur de connexion — réessaie.";
    console.error(e);
  } finally {
    askSend.disabled = false;
  }
}

function addMsg(cls, text) {
  const hint = askThread.querySelector(".ask-hint");
  if (hint) hint.remove();
  const el = document.createElement("div");
  el.className = `msg ${cls}`;
  el.textContent = text;
  askThread.appendChild(el);
  askThread.scrollTop = askThread.scrollHeight;
  return el;
}

/* Markdown minimal (titres ### et paragraphes) pour la synthèse */
function mdLite(text) {
  return text
    .split(/\n+/)
    .map(line => {
      line = line.trim();
      if (!line) return "";
      if (line.startsWith("### ")) return `<h3>${esc(line.slice(4))}</h3>`;
      if (line.startsWith("## ")) return `<h3>${esc(line.slice(3))}</h3>`;
      return `<p>${esc(line)}</p>`;
    })
    .join("");
}
