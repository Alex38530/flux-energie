// Fonction serverless Vercel — /api/news
// Nécessite la variable d'environnement ANTHROPIC_API_KEY (à définir dans Vercel).

// ⚙️ RÉGLAGE COÛT / QUALITÉ — change ces deux lignes pour ajuster ta facture.
// Haiku = ~4× moins cher que Sonnet, très bien pour extraire/résumer des recherches.
// Si une action échoue après changement, remets "claude-sonnet-4-6".
const MODEL_FAST = "claude-haiku-4-5-20251001"; // recherches + carnet (tâches lourdes)
const MODEL_SMART = "claude-sonnet-4-6";        // chat Q/R + synthèse (qualité)

const CAT_LIST = "nucleaire | renouvelables | stockage | petrole | geopolitique";

// Orientations éditoriales GÉNÉRALEMENT attribuées aux médias.
// Caractérisations approximatives et contestables, données à titre indicatif
// pour l'esprit critique — volontairement équilibrées sur tout le spectre.
const SOURCE_LEANING = {
  "le monde": "centre-gauche, généraliste de référence",
  "liberation": "gauche",
  "reporterre": "écologiste, orienté à gauche, militant sur l'environnement",
  "mediapart": "gauche, investigation",
  "l'humanite": "gauche",
  "le figaro": "droite, libéral-conservateur",
  "les echos": "libéral, orienté économie et entreprises (centre-droit)",
  "la tribune": "économique, sensibilité centre-droit / pro-marché",
  "l'usine nouvelle": "presse industrielle, orientation pro-industrie",
  "bfm business": "libéral, orienté marchés et entreprises",
  "contexte": "spécialiste des politiques publiques, plutôt factuel",
  "connaissance des energies": "spécialisé énergie, factuel, soutenu par des acteurs du secteur",
  "reuters": "agence de presse, ligne factuelle et neutre",
  "associated press": "agence de presse, ligne factuelle et neutre",
  "bloomberg": "orientation économique et pro-marché, public d'affaires",
  "financial times": "libéral économiquement, centriste, public d'affaires",
  "wall street journal": "informations centristes mais pages éditoriales orientées à droite",
  "the guardian": "centre-gauche",
  "bbc": "service public, ligne globalement centriste",
  "s&p global": "spécialiste marchés/énergie, factuel et financier",
  "iea": "agence intergouvernementale, analyses institutionnelles",
  "bloombergnef": "recherche spécialisée transition énergétique, orientation pro-décarbonation",
};

function normalizeSource(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST uniquement" });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY manquante côté serveur" });
  }

  const { action, scope, category, text } = req.body || {};

  try {
    if (action === "refresh") {
      const isFr = scope === "fr";
      const catHint =
        category && category !== "all"
          ? `Concentre-toi sur la catégorie "${category}".`
          : "Couvre l'ensemble du spectre énergie : nucléaire, renouvelables (solaire, éolien, hydro), stockage & batteries, pétrole/gaz, géopolitique de l'énergie.";
      const sources = isFr
        ? "presse française : Les Échos, Connaissance des Énergies, La Tribune, Le Monde, Reporterre, Contexte, L'Usine Nouvelle, BFM Business"
        : "presse internationale : Reuters, Bloomberg, Financial Times, IEA, Energy Intelligence, S&P Global, BloombergNEF, Wall Street Journal";

      const prompt = `Tu es un veilleur spécialisé énergie qui suit à la fois les technologies, les marchés et les entreprises du secteur. Recherche sur le web les actualités énergie les plus importantes des 7 derniers jours dans la ${sources}. ${catHint}

Champs à couvrir largement (directs ET indirects) :
- Batteries & stockage : stockage stationnaire sur réseau, gigafactories, véhicules électriques, hydrogène, gestion des réseaux électriques (grid, RTE, Enedis).
- Entreprises du secteur : EDF, TotalEnergies, Engie, Orano, Framatome, RTE, ainsi que Tesla, CATL, Northvolt, Siemens Energy, Ørsted, Shell, BP, NextEra, etc. — leurs résultats financiers, fusions-acquisitions, gros contrats, investissements.
- Signaux indirects : hausse de la demande électrique tirée par les data centers et l'IA, matières premières critiques (lithium, cuivre, terres rares, uranium), politiques et subventions, prix de l'électricité et du gaz.

Réponds UNIQUEMENT avec un JSON valide (aucun texte autour, pas de backticks) de la forme :
{"articles":[{"title":"...","source":"...","date":"AAAA-MM-JJ","summary":"résumé original de 1-2 phrases dans tes propres mots","url":"https://...","cat":"${CAT_LIST}","tab":"${isFr ? "fr" : "intl"}"}]}

Choix de la catégorie : "stockage" pour batteries/VE/hydrogène/réseaux, "nucleaire", "renouvelables" pour solaire/éolien/hydro, "petrole" pour pétrole/gaz, "geopolitique" pour tensions, sanctions, accords internationaux. Une actualité d'entreprise se classe dans la filière concernée (ex : gigafactory → stockage, résultats de TotalEnergies → petrole).

Règles : 5 à 7 articles maximum, résumés reformulés (jamais de texte copié), titres factuels, une seule catégorie par article. Fais des recherches ciblées et peu nombreuses pour rester économe.`;

      const data = await callClaude(apiKey, prompt, true, { model: MODEL_FAST, maxTokens: 1400, maxUses: 2 });
      const parsed = extractJson(data);
      return res.status(200).json({ articles: parsed?.articles || [] });
    }

    if (action === "classify") {
      if (!text) return res.status(400).json({ error: "texte manquant" });
      const prompt = `Voici un lien ou un extrait d'article sur l'énergie collé par l'utilisateur :

"""${text.slice(0, 4000)}"""

Si c'est une URL, recherche-la sur le web pour identifier l'article. Détermine :
- title : titre factuel
- source : nom du média
- date : AAAA-MM-JJ si connue, sinon omets
- summary : 1-2 phrases dans tes propres mots
- url : l'URL si disponible
- cat : une seule valeur parmi ${CAT_LIST}
- tab : "fr" si média français, sinon "intl"

Réponds UNIQUEMENT avec un JSON valide (aucun texte autour, pas de backticks) :
{"article":{...}}`;

      const data = await callClaude(apiKey, prompt, true, { model: MODEL_FAST, maxTokens: 700, maxUses: 1 });
      const parsed = extractJson(data);
      return res.status(200).json({ article: parsed?.article || null });
    }

    if (action === "synthesize") {
      const { articles } = req.body;
      if (!Array.isArray(articles) || !articles.length) {
        return res.status(400).json({ error: "articles manquants" });
      }
      const list = articles
        .map(a => `- [${a.cat}] ${a.title} (${a.source}, ${a.date}) : ${a.summary}`)
        .join("\n");

      const prompt = `Tu es un analyste énergie. Voici les articles du flux de veille de l'utilisateur :

${list}

Rédige un point d'actualité synthétique en français, structuré ainsi :
### L'essentiel
2-3 phrases sur la tendance dominante de la période.
### Par filière
Un court paragraphe par catégorie présente dans les articles (nucléaire, renouvelables, pétrole & gaz, géopolitique), en croisant les informations. Ignore les catégories absentes.
### À surveiller
1-2 points de vigilance ou échéances à venir déduits des articles.

Règles : uniquement du texte avec titres ###, pas de listes à puces, tout dans tes propres mots, ton factuel et direct, 250 mots maximum.`;

      const data = await callClaude(apiKey, prompt, false, { model: MODEL_SMART, maxTokens: 900 });
      const synthesis = (data.content || [])
        .filter(b => b.type === "text").map(b => b.text).join("\n").trim();
      return res.status(200).json({ synthesis });
    }

    if (action === "ask") {
      const { history, context } = req.body;
      if (!Array.isArray(history) || !history.length) {
        return res.status(400).json({ error: "question manquante" });
      }
      const ctxBlock = Array.isArray(context) && context.length
        ? "Articles du flux de veille de l'utilisateur (contexte prioritaire) :\n" +
          context.map(a => `- [${a.cat}] ${a.title} (${a.source}, ${a.date}) : ${a.summary}`).join("\n")
        : "Le flux de veille de l'utilisateur est vide.";

      const system = `Tu es l'assistant d'une application de veille sur l'énergie (nucléaire, renouvelables, pétrole/gaz, géopolitique). Réponds en français, de façon concise (150 mots max sauf si la question exige plus). Appuie-toi d'abord sur le contexte fourni ; utilise la recherche web seulement si le contexte ne suffit pas ou si la question porte sur du très récent. Cite tes sources par leur nom (ex : "selon Reuters"). Reformule toujours dans tes propres mots, ne recopie jamais de texte d'article. Si tu ne sais pas, dis-le.

${ctxBlock}`;

      const body = {
        model: MODEL_SMART,
        max_tokens: 900,
        system,
        messages: history.map(m => ({ role: m.role, content: String(m.content).slice(0, 2000) })),
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 1 }],
      };
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`Anthropic ${r.status}: ${t.slice(0, 300)}`);
      }
      const data = await r.json();
      const answer = (data.content || [])
        .filter(b => b.type === "text").map(b => b.text).join("\n").trim();
      return res.status(200).json({ answer });
    }

    if (action === "analyze") {
      const { article } = req.body;
      if (!article || !article.title) {
        return res.status(400).json({ error: "article manquant" });
      }
      const known = SOURCE_LEANING[normalizeSource(article.source)];
      const leaningHint = known
        ? `Orientation généralement attribuée à ${article.source} : ${known}. Reprends cette caractérisation en la nuançant.`
        : `Décris l'orientation éditoriale généralement attribuée à "${article.source}" si elle est connue, sinon indique "orientation non caractérisée".`;

      const prompt = `Tu analyses un article de veille énergie pour aider un lecteur à l'esprit critique. Article :
- Titre : ${article.title}
- Source : ${article.source || "inconnue"}
- Date : ${article.date || "inconnue"}
- Résumé : ${article.summary || "(non fourni)"}
- URL : ${article.url || "(non fournie)"}

Si l'URL est fournie, tu peux la consulter sur le web pour identifier l'auteur et préciser l'analyse.

Produis un objet JSON STRICT (aucun texte autour, pas de backticks) :
{
  "conclusion": "2 à 3 phrases dans tes propres mots : le point clé à retenir de l'article et sa portée.",
  "sourceLeaning": "Orientation éditoriale généralement attribuée à la source (spectre politique et/ou ligne économique), formulée de façon neutre et nuancée. Commence par 'Généralement décrit comme…'. Précise que c'est une caractérisation approximative et contestable. Si inconnue, dis-le simplement.",
  "authorContext": "Contexte UNIQUEMENT professionnel et public sur l'auteur si identifiable : média, spécialité, sujets habituellement couverts, expertise apparente sur l'énergie. N'inclus AUCUNE information privée (vie personnelle, adresse, famille…). Si l'auteur n'est pas identifiable, écris 'Auteur non identifié'."
}

${leaningHint}
Reste factuel, équilibré, et n'invente jamais d'information sur une personne.`;

      const body = {
        model: MODEL_FAST,
        max_tokens: 900,
        messages: [{ role: "user", content: prompt }],
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 1 }],
      };
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`Anthropic ${r.status}: ${t.slice(0, 300)}`);
      }
      const data = await r.json();
      const parsed = extractJson(data) || {};
      return res.status(200).json({
        analysis: {
          conclusion: parsed.conclusion || "Analyse indisponible.",
          sourceLeaning: parsed.sourceLeaning || (known ? `Généralement décrit comme ${known} (caractérisation approximative).` : "Orientation non caractérisée."),
          authorContext: parsed.authorContext || "Auteur non identifié.",
        },
      });
    }

    if (action === "digest") {
      const { domain, period, scope } = req.body;
      const PERIODS = {
        quotidien: "dernières 24-48 heures",
        hebdomadaire: "7 derniers jours",
        mensuel: "30 derniers jours",
        annuel: "12 derniers mois",
      };
      const periodLabel = PERIODS[period] || PERIODS.hebdomadaire;
      const scopeText =
        scope === "fr"
          ? "presse française (Les Échos, Connaissance des Énergies, La Tribune, Le Monde, Reporterre, L'Usine Nouvelle)"
          : scope === "intl"
          ? "presse internationale (Reuters, Bloomberg, Financial Times, IEA, BloombergNEF, S&P Global)"
          : "presse française ET internationale, en croisant les deux (Les Échos, Connaissance des Énergies, Le Monde, Reuters, Bloomberg, Financial Times, IEA)";

      const prompt = `Tu es un analyste énergie qui rédige un briefing de synthèse. Recherche sur le web l'actualité du domaine "${domain}" sur les ${periodLabel}, dans la ${scopeText}. Croise plusieurs sources : identifie les faits convergents, les chiffres, les tendances et les points de désaccord.

Rédige un dossier structuré et RÉPONDS UNIQUEMENT avec un JSON valide (aucun texte autour, pas de backticks) :
{
  "title": "titre accrocheur et factuel du dossier",
  "periodLabel": "libellé lisible de la période (ex: 'Semaine du 26 juin au 3 juillet 2026')",
  "summary": "chapô de 2-3 phrases résumant l'essentiel de la période",
  "sections": [
    { "heading": "titre de section", "body": "2-4 phrases dans tes propres mots, en citant les sources par leur nom" }
  ],
  "keyFigures": [
    { "label": "intitulé court", "value": "12 GW", "context": "précision en quelques mots + source" }
  ],
  "charts": [
    { "type": "bar", "title": "titre du graphique", "unit": "GW", "series": [ { "label": "2023", "value": 10 }, { "label": "2024", "value": 14 } ] }
  ],
  "sources": ["Reuters", "IEA", "Les Échos"]
}

Règles STRICTES :
- 3 à 5 sections, 3 à 6 chiffres clés.
- N'INVENTE JAMAIS de chiffre. N'inclus un graphique QUE si tu disposes de vraies données chiffrées issues des sources (2 à 6 points, valeurs numériques réelles). Si tu n'as pas de données fiables, mets "charts": [].
- type de graphique : "bar" ou "line" uniquement.
- Reformule tout dans tes propres mots, ne recopie jamais de phrases d'articles.
- Cite les sources par leur nom dans les sections et remplis "sources".
- Ton factuel, précis, sans esbroufe.`;

      const data = await callClaude(apiKey, prompt, true, { model: MODEL_SMART, maxTokens: 3200, maxUses: 4 });
      const parsed = extractJson(data) || {};
      return res.status(200).json({
        digest: {
          title: parsed.title || `Récap ${domain}`,
          periodLabel: parsed.periodLabel || periodLabel,
          summary: parsed.summary || "",
          sections: Array.isArray(parsed.sections) ? parsed.sections : [],
          keyFigures: Array.isArray(parsed.keyFigures) ? parsed.keyFigures : [],
          charts: Array.isArray(parsed.charts) ? parsed.charts.filter(c => Array.isArray(c.series) && c.series.length >= 2) : [],
          sources: Array.isArray(parsed.sources) ? parsed.sources : [],
        },
      });
    }

    return res.status(400).json({ error: "action inconnue" });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: "Erreur amont", detail: String(e.message || e) });
  }
}

async function callClaude(apiKey, prompt, withSearch, opts = {}) {
  const body = {
    model: opts.model || MODEL_FAST,
    max_tokens: opts.maxTokens || 1200,
    messages: [{ role: "user", content: prompt }],
  };
  if (withSearch) {
    body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: opts.maxUses || 2 }];
  }
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Anthropic ${r.status}: ${t.slice(0, 300)}`);
  }
  return r.json();
}

function extractJson(apiResponse) {
  const textBlocks = (apiResponse.content || [])
    .filter(b => b.type === "text")
    .map(b => b.text)
    .join("\n");
  const clean = textBlocks.replace(/```json|```/g, "").trim();
  // Prend le premier objet JSON complet trouvé
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(clean.slice(start, end + 1));
  } catch {
    return null;
  }
}
