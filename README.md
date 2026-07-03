# Fil — intelligence énergie

Application PWA de veille énergie organisée par **fils thématiques**. On choisit un thème, on génère un « point » qui croise plusieurs sources, et chaque nouveau point reprend la continuité (« ce qui a changé depuis le dernier point »).

## Fonctions
- **9 fils** : vue d'ensemble, nucléaire, solaire & éolien, batteries & stockage, pétrole & gaz, hydrogène, réseaux & marché de l'électricité, VE, géopolitique.
- **Point de fil** : titre, chapô, chiffres clés, graphiques (barres/courbes, uniquement si données réelles), sections thématiques, sources croisées.
- **Continuité** : à partir du 2ᵉ point, un encart « Depuis le dernier point » et des recherches ciblées sur la nouveauté (donc moins coûteuses).
- **Orientation des sources** : chaque source est colorée selon son orientation éditoriale généralement attribuée (indicatif et contestable). Table statique côté client → gratuit.
- **Export .md** par point. Stockage local (localStorage), par appareil.

## Déploiement (Vercel)
Identique aux versions précédentes : dépôt GitHub → import Vercel → variable `ANTHROPIC_API_KEY` → déployer. Installable sur écran d'accueil (PWA).

## Réglage du coût
Dans `api/news.js`, constante `MODEL` en haut :
- `"claude-sonnet-4-6"` : briefings plus riches (défaut).
- `"claude-haiku-4-5-20251001"` : ~4× moins cher, un peu moins fin.
Le nombre de recherches web est déjà réduit (3 pour un premier point, 2 pour une mise à jour).

## ⚠️ Avant toute commercialisation
Cette version tourne sur une **seule clé API** sans comptes utilisateurs : c'est un prototype personnel, pas un produit multi-utilisateurs. Voir les notes de mise sur le marché fournies séparément (auth, facturation, quotas, droits de reproduction, responsabilité des étiquettes d'orientation).
