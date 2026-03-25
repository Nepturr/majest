# MajestGPT — Context & Vision

## Règles de travail

- Après chaque modification de code, **push systématiquement sur `main`**, sauf si une action manuelle est requise de la part de l'utilisateur avant (ex: exécuter du SQL dans Supabase, configurer une variable d'environnement, etc.). Dans ce cas, indiquer clairement ce qui est à faire avant de pusher.
- **Le frontend est entièrement en anglais.** Tout texte visible dans l'interface (labels, placeholders, messages d'erreur, titres, boutons) doit être en anglais.

## Vision

MajestGPT est le CRM interne de l'agence OnlyFans **Majest**. Son objectif principal est de **maximiser la performance marketing** des modèles gérés par l'agence, en commençant par **Instagram** (analyse de Reels).

L'outil doit être :
- **Moderne & ergonomique** : utilisé quotidiennement par de nombreux employés
- **Data-driven** : chaque décision marketing est guidée par des métriques précises
- **Scalable** : pensé pour accueillir de nouveaux canaux (Meta ads,TikTok, Twitter/X, Reddit…)

## Stack Technique

| Couche | Technologie |
|--------|-------------|
| Frontend | Next.js 16 (App Router) + Tailwind CSS 4 |
| Backend / BDD | Supabase (PostgreSQL + Auth + Storage) |
| Hébergement | Vercel |
| Repo | https://github.com/Nepturr/majest |

## Modules

### 1. Dashboard (v0.1)
- Vue d'ensemble des KPIs globaux
- Activité récente
- Accès rapide aux modules

### 2. Instagram Reels Analyzer (v0.1)
- Ajout d'un Reel via URL ou upload
- Décomposition exacte du Reel : hook, structure, durée, musique, texte overlay, CTA
- Scoring de performance
- Historique des analyses

## APIs externes

### OneUp (oneupapp.io)
- Base URL : `https://www.oneupapp.io/api`
- Auth : query param `?apiKey={oneup_api_key}` (clé stockée dans `settings.oneup_api_key`, jamais exposée côté client)
- Usage principal : **scheduling de posts Instagram** (Reels, images, stories)
- Concepts clés :
  - **Category** : groupe de comptes sociaux. Chaque category a un `id` et un `category_name`.
  - **social_network_id** : ID unique d'un compte social dans une catégorie, requis pour scheduler un post.
- Endpoints utilisés :
  - `GET /api/listcategory?apiKey=...` — liste toutes les catégories (test de connexion)
  - `GET /api/listcategoryaccount?apiKey=...&category_id=ID` — liste les comptes sociaux d'une catégorie (retourne `social_network_id`)
  - `GET /api/listsocialaccounts?apiKey=...` — liste TOUS les comptes connectés (tous réseaux)
  - `POST /api/schedulevideopost` — schedule un Reel/vidéo. Params requis : `category_id`, `social_network_id` (JSON array ou `"ALL"`), `scheduled_date_time` (YYYY-MM-DD HH:MM), `content`, `video_url`. Param Instagram : `instagram={"isTrialReel":1|2}` (1 = graduation manuelle, 2 = auto si performances OK)
  - `POST /api/scheduleimagepost` — schedule un post image/carrousel. Param : `image_url` (plusieurs séparées par `~~`). Instagram : `instagram={"isStory":true}`
  - `GET /api/getscheduledposts?apiKey=...&start=0` — liste les posts programmés (paginator 50/page)
  - `GET /api/getpublishedposts?apiKey=...&start=0` — historique des posts publiés
  - `GET /api/getfailedposts?apiKey=...&start=0` — liste des posts en échec
- Response structure : `{ message: string, error: boolean, data: [...] }`
- Test de connexion via `GET /api/admin/oneup/test` → appelle `/api/listcategory` et retourne le nombre de catégories
- **Note** : OneUp est utilisé UNIQUEMENT pour le scheduling. Les stats de performance des Reels sont récupérées via Apify (scraping Instagram Insights), pas via OneUp.

### OnlyFansAPI (onlyfansapi.com)
- Base URL : `https://app.onlyfansapi.com/api`
- Auth : header `Authorization: Bearer {ofapi_api_key}` (clé stockée dans `settings.ofapi_api_key`)
- Système de crédits : 1 crédit/requête non-cachée, 0 pour cachée
- Les endpoints account-spécifiques sont préfixés `/api/{account_id}/...` (ex: `acct_XXXXXXXX`)
- Le `account_id` OFAPI est stocké dans `accounts.ofapi_account_id` (contrainte `unique` — un compte OF ne peut être attribué qu'à une seule modèle)
- Endpoints clés :
  - `GET /api/{account_id}/earning-statistics` — Revenue total + time series
  - `GET /api/{account_id}/fans/latest` — Derniers subscribers (nouveaux + renouvellements)
  - `GET /api/{account_id}/fans/active` — Subscribers actifs
  - `GET /api/{account_id}/tracking-links` — Performance des tracking links
- Response structure : `{ data: {...}, _meta: { _credits, _cache, _rate_limits }, _pagination?: { next_page } }`
- Test de connexion via `POST /api/client-sessions` → `GET /api/admin/ofapi/test`

### GetMySocial API v2
- Base URL : `https://getmysocial.com`
- Auth : header `x-api-key` (clé stockée dans `settings.gms_api_key`, jamais exposée côté client)
- Endpoints utilisés :
  - `GET /api/v2/links` — liste tous les liens du compte (retourne `_id` = `getMySocialLinkId`)
  - `GET /api/v2/analytics/overview?scope=link&linkId={id}` — totalClicks, uniqueVisitors, top countries/devices/referrers
  - `GET /api/v2/analytics/dimensions/countries?scope=link&linkId={id}` — breakdown pays complet (pour calculer le Tier 1 %)
  - `GET /api/v2/analytics/time-series?scope=link&linkId={id}&interval=day` — clics par jour
- Tier 1 = pays : US, UK, CA, AU, DE, FR (à calculer en % depuis les données countries)
- Toutes les calls GMS se font côté serveur (API routes Next.js) — test de connexion disponible via `GET /api/admin/gms/test`

## Architecture de données

### Table `models`
Un persona AI avec une apparence physique fixe définie par un LoRA.
Champs : `name`, `avatar_url`, `persona`, `lora_id`, `lora_thumbnail_url`, `brand_notes`, `status` (active/inactive).

### Table `accounts`
Un compte OnlyFans associé à une modèle.
Champs clés : `model_id` (FK), `ofapi_account_id` (unique — ID OFAPI ex: `acct_XXXXXXXX`), `of_username`, `of_avatar_url`, `instagram_handle`, `niche`, `get_my_social_link_id` (GetMySocial API), `of_tracking_link` (tracking link OF).

### Sources de données du funnel
- **GetMySocial** : clics bio → `GET /api/v2/analytics/overview?scope=link&linkId={getMySocialLinkId}`
- **OnlyFans API** (via onlyfansapi.com) : subscribers, revenue, tracking links
- **Apify** : scraping Instagram Insights pour les stats de reels

## Historique des Mises à Jour

### v0.2.2 — 25 Mars 2026
- Intégration OneUp API : clé stockée dans `settings.oneup_api_key`, carte de config dans Admin → API
- Route test `/api/admin/oneup/test` (connexion via listcategory)
- Documentation complète OneUp dans context.md

### v0.2.0 — 25 Mars 2026
- Panel Admin : nouvel onglet "Models" (liste, ajout, édition, suppression)
- Formulaire "Ajouter une modèle" : nom, avatar URL, persona, LoRA ID, LoRA thumbnail, brand notes, statut
- Routes API CRUD `/api/admin/models` et `/api/admin/models/[id]`
- Schéma Supabase : tables `models` + `accounts` (avec RLS)
- Types TypeScript : `Model`, `Account`
- Page `/models` connectée aux vraies données Supabase

### v0.1.0 — 24 Mars 2026
- Initialisation du projet (Next.js 16 + Tailwind + Supabase)
- Création du layout CRM (sidebar, header, navigation)
- Dashboard avec statistiques
- Module Instagram Reels Analyzer (analyse de composition)
- Déploiement Vercel configuré
- Repo GitHub : https://github.com/Nepturr/majest
