// Fil — fonction serverless Vercel (/api/news)
// Une seule action : générer un "point" de fil (briefing), avec continuité.
// Nécessite la variable d'environnement ANTHROPIC_API_KEY.

// ⚙️ RÉGLAGE COÛT / QUALITÉ
// Haiku ("claude-haiku-4-5-20251001") ≈ 4× moins cher, un peu moins fin.
// Sonnet donne des briefings plus riches. Si une génération échoue, remets Sonnet.
const MODEL = "claude-sonnet-4-6";

const SOURCES_FR =
  "Les Échos, Connaissance des Énergies, La Tribune, Le Monde, Le Figaro, Libération, Mediapart, Reporterre, L'Usine Nouvelle, Novethic, Contexte, Montel, Enerpresse, BFM Business, Alternatives Économiques";
const SOURCES_INTL =
  "Reuters, Bloomberg, Financial Times, The Economist, Wall Street Journal, IEA, BloombergNEF, S&P Global Platts, Argus Media, Carbon Brief, Utility Dive, PV Magazine, Recharge News, Politico Energy, Axios";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST uniquement" });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY manquante côté serveur" });

  const { domain, period, scope, previous } = req.body || {};
  if (!domain) return res.status(400).json({ error: "domaine manquant" });

  const PERIODS = {
    quotidien: "dernières 24-48 heures",
    hebdomadaire: "7 derniers jours",
    mensuel: "30 derniers jours",
    annuel: "12 derniers mois",
  };
  const periodText = PERIODS[period] || PERIODS.hebdomadaire;
  const scopeText =
    scope === "fr" ? `presse française (${SOURCES_FR})`
    : scope === "intl" ? `presse internationale (${SOURCES_INTL})`
    : `presse française ET internationale, croisées (${SOURCES_FR} ; ${SOURCES_INTL})`;

  const hasPrev = previous && previous.summary;
  const continuity = hasPrev
    ? `\n\nPOINT PRÉCÉDENT de ce fil (${previous.date}) :\n"${String(previous.summary).slice(0, 800)}"\nRemplis "evolution" avec ce qui a changé, avancé ou été confirmé DEPUIS ce point, et oriente tes recherches vers la nouveauté.`
    : `\n\nPremier point de ce fil : "evolution" doit être une chaîne vide "".`;

  const maxUses = hasPrev ? 2 : 3;         // une mise à jour cherche moins → moins chère
  const maxTokens = hasPrev ? 2400 : 2900;

  const prompt = `Tu es un analyste énergie qui rédige un briefing de synthèse pour un produit professionnel. Domaine : "${domain}". Période : ${periodText}. Sources : ${scopeText}.

Recherche sur le web, croise plusieurs sources, identifie faits convergents, chiffres, tendances et désaccords.${continuity}

RÉPONDS UNIQUEMENT avec un JSON valide (aucun texte autour, pas de backticks) :
{
  "title": "titre factuel et incisif",
  "periodLabel": "libellé lisible (ex: 'Semaine du 26 juin au 3 juillet 2026')",
  "evolution": "2-3 phrases sur ce qui a changé depuis le point précédent, ou \\"\\" si premier point",
  "summary": "chapô de 2-3 phrases sur l'essentiel de la période",
  "sections": [ { "heading": "titre", "body": "2-4 phrases reformulées, sources citées par leur nom" } ],
  "keyFigures": [ { "label": "intitulé court", "value": "12 GW", "context": "précision + source" } ],
  "charts": [ { "type": "bar", "title": "titre", "unit": "GW", "series": [ { "label": "2023", "value": 10 }, { "label": "2024", "value": 14 } ] } ],
  "sources": ["Reuters", "IEA", "Les Échos"]
}

RÈGLES STRICTES :
- 3 à 5 sections, 3 à 6 chiffres clés.
- N'INVENTE JAMAIS de chiffre. N'inclus un graphique QUE si tu as de vraies données chiffrées issues des sources (2 à 6 points numériques réels), sinon "charts": [].
- type de graphique : "bar" ou "line" uniquement.
- Reformule tout, ne recopie jamais de phrases d'articles.
- Cite les sources par leur nom et remplis "sources" avec les médias réellement utilisés.
- Ton factuel et précis.`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: maxUses }],
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`Anthropic ${r.status}: ${t.slice(0, 300)}`);
    }
    const data = await r.json();
    const p = extractJson(data) || {};
    return res.status(200).json({
      digest: {
        title: p.title || `Point ${domain}`,
        periodLabel: p.periodLabel || periodText,
        evolution: typeof p.evolution === "string" ? p.evolution : "",
        summary: p.summary || "",
        sections: Array.isArray(p.sections) ? p.sections : [],
        keyFigures: Array.isArray(p.keyFigures) ? p.keyFigures : [],
        charts: Array.isArray(p.charts) ? p.charts.filter(c => Array.isArray(c.series) && c.series.length >= 2) : [],
        sources: Array.isArray(p.sources) ? p.sources : [],
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: "Erreur amont", detail: String(e.message || e) });
  }
}

function extractJson(apiResponse) {
  const text = (apiResponse.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
  const clean = text.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{"), end = clean.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try { return JSON.parse(clean.slice(start, end + 1)); } catch { return null; }
}
