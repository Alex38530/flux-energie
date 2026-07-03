// Fonction serverless Vercel — /api/news
// Nécessite la variable d'environnement ANTHROPIC_API_KEY (à définir dans Vercel).

const CAT_LIST = "nucleaire | renouvelables | petrole | geopolitique";

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
          : "Couvre les 4 catégories : nucléaire, renouvelables, pétrole/gaz, géopolitique de l'énergie.";
      const sources = isFr
        ? "presse française : Les Échos, Connaissance des Énergies, La Tribune, Le Monde, Reporterre, Contexte"
        : "presse internationale : Reuters, Bloomberg, Financial Times, IEA, Energy Intelligence, S&P Global";

      const prompt = `Tu es un veilleur spécialisé énergie. Recherche sur le web les actualités énergie les plus importantes des 7 derniers jours dans la ${sources}. ${catHint}

Réponds UNIQUEMENT avec un JSON valide (aucun texte autour, pas de backticks) de la forme :
{"articles":[{"title":"...","source":"...","date":"AAAA-MM-JJ","summary":"résumé original de 1-2 phrases dans tes propres mots","url":"https://...","cat":"${CAT_LIST}","tab":"${isFr ? "fr" : "intl"}"}]}

Règles : 5 à 8 articles maximum, résumés reformulés (jamais de texte copié), titres factuels, une seule catégorie par article.`;

      const data = await callClaude(apiKey, prompt, true);
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

      const data = await callClaude(apiKey, prompt, true);
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

      const data = await callClaude(apiKey, prompt, false);
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
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        system,
        messages: history.map(m => ({ role: m.role, content: String(m.content).slice(0, 2000) })),
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 2 }],
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

    return res.status(400).json({ error: "action inconnue" });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: "Erreur amont", detail: String(e.message || e) });
  }
}

async function callClaude(apiKey, prompt, withSearch) {
  const body = {
    model: "claude-sonnet-4-6",
    max_tokens: 2500,
    messages: [{ role: "user", content: prompt }],
  };
  if (withSearch) {
    body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }];
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
