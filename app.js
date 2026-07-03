/* Fil — intelligence énergie. Logique client. */

const DOMAINS = [
  "Vue d'ensemble", "Nucléaire", "Solaire & éolien", "Batteries & stockage",
  "Pétrole & gaz", "Hydrogène", "Réseaux & marché de l'électricité",
  "Véhicules électriques", "Géopolitique de l'énergie",
];
const PERIODS = [
  { v: "quotidien", l: "Quotidien" }, { v: "hebdomadaire", l: "Hebdomadaire" },
  { v: "mensuel", l: "Mensuel" }, { v: "annuel", l: "Annuel" },
];
const SCOPES = [
  { v: "both", l: "FR + international" }, { v: "fr", l: "France" }, { v: "intl", l: "International" },
];

/* Orientation éditoriale — caractérisations générales et contestables (convention FR).
   Statique = affichée sans appel API, donc gratuite. */
const LEAN = {
  "le monde": "cg", "libération": "gauche", "liberation": "gauche", "mediapart": "gauche",
  "l'humanité": "gauche", "reporterre": "gauche", "alternatives économiques": "cg",
  "le figaro": "droite", "les échos": "cd", "les echos": "cd", "la tribune": "cd",
  "l'usine nouvelle": "spe", "bfm business": "cd", "contexte": "centre", "novethic": "cg",
  "connaissance des énergies": "spe", "connaissance des energies": "spe", "montel": "spe", "enerpresse": "spe",
  "reuters": "centre", "associated press": "centre", "ap": "centre", "bbc": "centre",
  "the guardian": "cg", "bloomberg": "cd", "bloombergnef": "spe", "financial times": "centre",
  "the economist": "cd", "wall street journal": "cd", "politico": "centre", "axios": "centre",
  "iea": "inst", "s&p global": "spe", "s&p global platts": "spe", "argus": "spe", "argus media": "spe",
  "carbon brief": "spe", "utility dive": "spe", "pv magazine": "spe", "recharge": "spe", "recharge news": "spe",
};
const LEAN_LABEL = {
  gauche: "gauche", cg: "centre-gauche", centre: "centre", cd: "centre-droit",
  droite: "droite", spe: "spécialisé", inst: "institutionnel",
};

const state = {
  fils: load("fils", {}),   // { [domain]: [ point, point, ... ] (récent d'abord) }
  form: { period: "hebdomadaire", scope: "both" },
};
let currentDomain = null;

function load(k, f) { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } }
function persist() { localStorage.setItem("fils", JSON.stringify(state.fils)); }

const view = document.getElementById("view");
const backBtn = document.getElementById("backBtn");
const toast = document.getElementById("toast");

backBtn.addEventListener("click", () => { currentDomain = null; render(); });

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function showToast(m) {
  toast.textContent = m; toast.classList.add("show");
  clearTimeout(showToast._t); showToast._t = setTimeout(() => toast.classList.remove("show"), 2800);
}
function pointsOf(d) { return state.fils[d] || []; }

/* ================= ROUTAGE ================= */
function render() {
  view.innerHTML = "";
  backBtn.hidden = !currentDomain;
  if (currentDomain) renderFil(currentDomain);
  else renderHome();
  window.scrollTo(0, 0);
}

/* ---------- Accueil : liste des fils ---------- */
function renderHome() {
  const intro = document.createElement("div");
  intro.className = "home-intro";
  intro.innerHTML = `<h1>Suis l'énergie, fil par fil.</h1>
    <p>Choisis un thème, génère un point d'actualité croisant plusieurs sources. Chaque nouveau point reprend le fil là où tu l'avais laissé.</p>`;
  view.appendChild(intro);

  const eyebrow = document.createElement("span");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Thèmes";
  view.appendChild(eyebrow);

  const list = document.createElement("div");
  list.className = "fil-list";
  for (const d of DOMAINS) {
    const pts = pointsOf(d);
    const last = pts[0];
    const card = document.createElement("button");
    card.className = "fil-card" + (pts.length ? " live" : "");
    card.innerHTML = `
      <div class="fil-thread">
        <span class="node top"></span><span class="node mid"></span><span class="node bot"></span>
      </div>
      <div class="fil-body">
        <div class="fil-name">${esc(d)}</div>
        <div class="fil-meta">${pts.length ? `${pts.length} point${pts.length > 1 ? "s" : ""} · maj ${esc(last.date)}` : "aucun point"}</div>
        ${last ? `<div class="fil-latest">${esc(last.title)}</div>` : ""}
      </div>
      ${pts.length ? `<span class="fil-count">${pts.length}</span>` : ""}`;
    card.addEventListener("click", () => { currentDomain = d; render(); });
    list.appendChild(card);
  }
  view.appendChild(list);
}

/* ---------- Vue d'un fil ---------- */
function renderFil(d) {
  const header = document.createElement("div");
  header.className = "fil-header";
  header.innerHTML = `<span class="kicker">Fil</span><h1>${esc(d)}</h1>`;
  view.appendChild(header);

  // Générateur
  const gen = document.createElement("div");
  gen.className = "gen";
  const hasPrev = pointsOf(d).length > 0;
  gen.innerHTML = `
    <div class="gen-row">
      <label>Période
        <select id="gPeriod">${PERIODS.map(p => `<option value="${p.v}" ${p.v === state.form.period ? "selected" : ""}>${p.l}</option>`).join("")}</select>
      </label>
      <label>Sources
        <select id="gScope">${SCOPES.map(s => `<option value="${s.v}" ${s.v === state.form.scope ? "selected" : ""}>${s.l}</option>`).join("")}</select>
      </label>
    </div>
    <button class="btn-gen" id="gGo">${hasPrev ? "Reprendre le fil" : "Ouvrir le fil"}</button>
    <p class="gen-note">${hasPrev ? "Mise à jour depuis le dernier point · ~0,10-0,20 €" : "Premier point · ~0,15-0,30 €"}</p>`;
  view.appendChild(gen);
  gen.querySelector("#gPeriod").addEventListener("change", e => state.form.period = e.target.value);
  gen.querySelector("#gScope").addEventListener("change", e => state.form.scope = e.target.value);
  gen.querySelector("#gGo").addEventListener("click", () => generatePoint(d));

  const pts = pointsOf(d);
  if (!pts.length) {
    const note = document.createElement("p");
    note.className = "empty-note";
    note.textContent = "Ce fil est vierge. Génère un premier point pour lancer le suivi.";
    view.appendChild(note);
    return;
  }

  // Timeline : le plus récent déplié, les autres repliés
  const tl = document.createElement("div");
  tl.className = "timeline";
  pts.forEach((p, i) => {
    const wrap = document.createElement("div");
    wrap.className = "point" + (i === 0 ? " newest" : "");
    if (i === 0) {
      wrap.appendChild(articleEl(p, d, true));
    } else {
      const c = document.createElement("button");
      c.className = "point-collapsed";
      c.innerHTML = `<span class="pc-date">${esc(p.date)} · ${esc(periodLabel(p.period))}</span><div class="pc-title">${esc(p.title)}</div>`;
      c.addEventListener("click", () => openPoint(d, p.id));
      wrap.appendChild(c);
    }
    tl.appendChild(wrap);
  });
  view.appendChild(tl);
}

let expandedId = null;
function openPoint(d, id) {
  expandedId = expandedId === id ? null : id;
  // re-render fil avec le point ciblé déplié
  const pts = pointsOf(d);
  view.querySelectorAll(".timeline").forEach(el => el.remove());
  const tl = document.createElement("div");
  tl.className = "timeline";
  pts.forEach((p, i) => {
    const wrap = document.createElement("div");
    wrap.className = "point" + (i === 0 ? " newest" : "");
    if (i === 0 || p.id === expandedId) {
      wrap.appendChild(articleEl(p, d, i === 0));
    } else {
      const c = document.createElement("button");
      c.className = "point-collapsed";
      c.innerHTML = `<span class="pc-date">${esc(p.date)} · ${esc(periodLabel(p.period))}</span><div class="pc-title">${esc(p.title)}</div>`;
      c.addEventListener("click", () => openPoint(d, p.id));
      wrap.appendChild(c);
    }
    tl.appendChild(wrap);
  });
  view.appendChild(tl);
}

/* ---------- Génération d'un point ---------- */
async function generatePoint(d) {
  const btn = document.getElementById("gGo");
  btn.disabled = true; btn.textContent = "Lecture des sources… (30-60 s)";
  const loader = document.createElement("div");
  loader.className = "loading-card";
  loader.innerHTML = `<div class="sk w40"></div><div class="sk h40"></div><div class="sk"></div><div class="sk w60"></div>`;
  const oldTl = view.querySelector(".timeline"); if (oldTl) oldTl.remove();
  const oldNote = view.querySelector(".empty-note"); if (oldNote) oldNote.remove();
  view.appendChild(loader);

  const prev = pointsOf(d)[0];
  try {
    const res = await fetch("/api/news", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domain: d, period: state.form.period, scope: state.form.scope,
        previous: prev ? { date: prev.date, summary: prev.summary } : null,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const digest = (await res.json()).digest;
    if (!digest || !digest.title) throw new Error("Réponse vide");
    const point = {
      id: crypto.randomUUID(), date: new Date().toISOString().slice(0, 10),
      period: state.form.period, scope: state.form.scope, ...digest,
    };
    if (!state.fils[d]) state.fils[d] = [];
    state.fils[d].unshift(point);
    state.fils[d] = state.fils[d].slice(0, 40);
    persist();
    render();
    showToast("Fil mis à jour");
  } catch (e) {
    loader.remove();
    btn.disabled = false; btn.textContent = prev ? "Reprendre le fil" : "Ouvrir le fil";
    showToast("Échec — réessaie dans un instant");
    console.error(e);
  }
}

/* ---------- Rendu d'un article (point) ---------- */
function articleEl(p, domain, isNewest) {
  const el = document.createElement("article");
  el.className = "article";

  const figures = (p.keyFigures || []).map(f =>
    `<div class="kf"><span class="kf-value">${esc(f.value)}</span><span class="kf-label">${esc(f.label)}</span>${f.context ? `<span class="kf-ctx">${esc(f.context)}</span>` : ""}</div>`).join("");
  const charts = (p.charts || []).map(svgChart).join("");
  const sections = (p.sections || []).map(s =>
    `<div class="a-section"><h3>${esc(s.heading)}</h3><p>${esc(s.body)}</p></div>`).join("");
  const sources = renderSources(p.sources || []);
  const evo = (isNewest && p.evolution)
    ? `<div class="evolution"><span class="lbl">Depuis le dernier point</span><p>${esc(p.evolution)}</p></div>` : "";

  el.innerHTML = `
    <div class="article-top">
      ${isNewest ? `<span class="badge-live">Point actuel</span>` : `<span class="badge-live" style="color:var(--ink-soft)">${esc(p.date)}</span>`}
      <button class="a-export">⬇ .md</button>
    </div>
    <h2>${esc(p.title)}</h2>
    <div class="a-period">${esc(p.periodLabel || periodLabel(p.period))}</div>
    ${evo}
    ${p.summary ? `<p class="a-summary">${esc(p.summary)}</p>` : ""}
    ${figures ? `<div class="kf-grid">${figures}</div>` : ""}
    ${charts}
    ${sections}
    ${sources}`;
  el.querySelector(".a-export").addEventListener("click", () => exportPoint(p, domain));
  return el;
}

function renderSources(list) {
  if (!list.length) return "";
  const seen = new Set();
  const chips = list.map(s => {
    const key = String(s).toLowerCase().trim();
    if (seen.has(key)) return ""; seen.add(key);
    const lean = LEAN[key] || "centre";
    return `<span class="src-chip"><span class="src-dot" style="background:var(--lean-${lean})"></span>${esc(s)}</span>`;
  }).join("");
  return `<div class="a-sources"><span class="lbl">Sources croisées &amp; orientation</span>
    <div class="src-chips">${chips}</div>
    <p class="lean-legend">Orientations indicatives et contestables (convention FR : rouge = gauche, bleu = droite, vert = spécialisé, violet = institutionnel).</p></div>`;
}

function periodLabel(v) { const p = PERIODS.find(x => x.v === v); return p ? p.l : (v || ""); }

/* ---------- Graphiques SVG (sans dépendance) ---------- */
function svgChart(c) {
  const series = (c.series || []).filter(p => typeof p.value === "number" && isFinite(p.value));
  if (series.length < 2) return "";
  const W = 620, H = 240, padL = 46, padR = 16, padT = 26, padB = 40;
  const iw = W - padL - padR, ih = H - padT - padB;
  const vals = series.map(p => p.value);
  const maxV = Math.max(...vals, 0), minV = Math.min(...vals, 0);
  const span = (maxV - minV) || 1;
  const y = v => padT + ih - ((v - minV) / span) * ih;
  const title = esc(c.title || ""), unit = c.unit ? esc(c.unit) : "";
  let g = `<text x="${padL}" y="16" class="ch-title">${title}${unit ? ` (${unit})` : ""}</text>`;
  g += `<line x1="${padL}" y1="${y(minV)}" x2="${W - padR}" y2="${y(minV)}" class="ch-axis"/>`;
  if ((c.type || "bar") === "line") {
    const step = iw / (series.length - 1);
    g += `<polyline points="${series.map((p, i) => `${padL + i * step},${y(p.value)}`).join(" ")}" class="ch-line"/>`;
    series.forEach((p, i) => {
      const cx = padL + i * step;
      g += `<circle cx="${cx}" cy="${y(p.value)}" r="3.5" class="ch-dot"/>`;
      g += `<text x="${cx}" y="${y(p.value) - 8}" class="ch-val">${esc(String(p.value))}</text>`;
      g += `<text x="${cx}" y="${H - 14}" class="ch-lbl">${esc(p.label || "")}</text>`;
    });
  } else {
    const gap = iw / series.length, bw = gap * 0.6;
    series.forEach((p, i) => {
      const cx = padL + i * gap + (gap - bw) / 2, yy = y(p.value), y0 = y(Math.min(0, minV));
      g += `<rect x="${cx}" y="${Math.min(yy, y0)}" width="${bw}" height="${Math.abs(y0 - yy)}" class="ch-bar" rx="2"/>`;
      g += `<text x="${cx + bw / 2}" y="${Math.min(yy, y0) - 6}" class="ch-val">${esc(String(p.value))}</text>`;
      g += `<text x="${cx + bw / 2}" y="${H - 14}" class="ch-lbl">${esc(p.label || "")}</text>`;
    });
  }
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}">${g}</svg>`;
}

/* ---------- Export markdown ---------- */
function exportPoint(p, domain) {
  const L = [`# ${p.title}`, `*${domain} — ${p.periodLabel || periodLabel(p.period)} — ${p.date}*`, ""];
  if (p.evolution) L.push(`> **Depuis le dernier point.** ${p.evolution}`, "");
  if (p.summary) L.push(p.summary, "");
  if ((p.keyFigures || []).length) {
    L.push("## Chiffres clés", "");
    p.keyFigures.forEach(f => L.push(`- **${f.value}** — ${f.label}${f.context ? ` (${f.context})` : ""}`));
    L.push("");
  }
  (p.sections || []).forEach(s => L.push(`## ${s.heading}`, "", s.body, ""));
  (p.charts || []).forEach(c => {
    L.push(`### ${c.title}${c.unit ? ` (${c.unit})` : ""}`, "");
    (c.series || []).forEach(pt => L.push(`- ${pt.label} : ${pt.value}`));
    L.push("");
  });
  if ((p.sources || []).length) L.push("---", `*Sources croisées : ${p.sources.join(", ")}*`);
  const blob = new Blob([L.join("\n")], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fil-${domain.toLowerCase().replace(/[^a-z]+/g, "-")}-${p.date}.md`;
  a.click(); URL.revokeObjectURL(url);
}

/* ---------- Service worker ---------- */
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

render();
