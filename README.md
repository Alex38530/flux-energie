# Flux Énergie — veille presse énergie (PWA)

Tableau de bord de veille sur l'actualité énergétique : presse internationale et française, 4 catégories (nucléaire, renouvelables, pétrole & gaz, géopolitique), recherche web en direct + classement de liens collés, sauvegarde locale des articles marqués.

## Déploiement sur Vercel (recommandé, gratuit)

1. Crée un compte sur https://vercel.com (connexion GitHub possible).
2. Crée une clé API Anthropic sur https://console.anthropic.com (menu API Keys). Elle commence par `sk-ant-`.
3. Deux options pour déployer :
   - **Sans terminal** : mets ce dossier sur un repo GitHub, puis dans Vercel → "Add New Project" → importe le repo. Vercel détecte tout automatiquement.
   - **Avec terminal** : `npm i -g vercel` puis `vercel` dans ce dossier.
4. Dans Vercel → ton projet → **Settings → Environment Variables** : ajoute
   - Nom : `ANTHROPIC_API_KEY`
   - Valeur : ta clé `sk-ant-...`
   - Environnement : Production (et Preview si tu veux)
5. Redéploie (bouton "Redeploy") pour que la variable soit prise en compte.
6. Ton appli est en ligne sur `https://ton-projet.vercel.app`.

⚠️ La clé API reste côté serveur (fonction `/api/news`), elle n'est jamais visible dans le navigateur. Ne la mets jamais dans le code front.

💰 Coût : Vercel est gratuit pour cet usage. Les appels à l'API Anthropic sont facturés à l'usage (quelques centimes par actualisation avec la recherche web). Tu peux mettre une limite de dépense dans la console Anthropic.

## Installer sur ton écran d'accueil

**iPhone (Safari)** : ouvre l'URL → bouton Partager (carré avec flèche) → "Sur l'écran d'accueil" → Ajouter.

**Android (Chrome)** : ouvre l'URL → menu ⋮ → "Ajouter à l'écran d'accueil" (ou bannière "Installer l'application").

L'appli s'ouvre alors en plein écran, sans barre de navigateur.

## Utilisation

- **Actualiser** : lance une recherche web sur les actus énergie des 7 derniers jours. L'onglet actif détermine le périmètre (Internationale ou Française), et le filtre de catégorie actif cible la recherche.
- **Coller un lien/extrait** : la zone en bas classe automatiquement l'article (catégorie + onglet FR/international).
- **À lire / Important** : marque un article — il apparaît dans l'onglet "Sauvegardés". Tout est stocké sur ton appareil (localStorage), rien ne part sur un serveur.
- **✕** : supprime un article du flux.
- **📋 Synthèse du flux** : rédige un point d'actualité structuré (L'essentiel / Par filière / À surveiller) à partir des articles actuellement affichés (onglet + filtre actifs).
- **💬 Questions** : chat en temps réel — pose une question, la réponse s'appuie d'abord sur tes articles, puis sur une recherche web si nécessaire. L'historique du chat dure le temps de la session.

## Structure

```
├── index.html          Interface
├── styles.css          Styles
├── app.js              Logique client (état, rendu, appels API)
├── manifest.json       Manifest PWA
├── sw.js               Service worker (cache offline de l'interface)
├── icons/              Icônes 192/512 + maskable
└── api/
    └── news.js         Fonction serverless Vercel (recherche + classification)
```

## Personnaliser

- **Sources prioritaires** : dans `api/news.js`, variables `sources` (lignes ~25-28).
- **Nombre d'articles** : dans le prompt de `api/news.js` ("5 à 8 articles").
- **Couleurs des catégories** : dans `styles.css`, variables `--nucleaire`, `--renouvelables`, etc.
- **Modèle** : `claude-sonnet-4-6` dans `api/news.js` (bon rapport qualité/prix pour ce cas).
