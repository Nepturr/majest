# MajestGPT — Context & Vision

## Règles de travail

- Après chaque modification de code, **push systématiquement sur `main`**, sauf si une action manuelle est requise de la part de l'utilisateur avant (ex: exécuter du SQL dans Supabase, configurer une variable d'environnement, etc.). Dans ce cas, indiquer clairement ce qui est à faire avant de pusher.
- **Le frontend est entièrement en anglais.** Tout texte visible dans l'interface (labels, placeholders, messages d'erreur, titres, boutons) doit être en anglais.
- Toujours lire le `context.md` et le code existant avant de modifier quoi que ce soit.

---

## Vision

MajestGPT est le CRM interne de l'agence OnlyFans **Majest**. Son objectif principal est de **maximiser la performance marketing** des modèles gérées par l'agence, en commençant par **Instagram** (génération + scheduling de contenu, analyse de performance).

L'outil doit être :
- **Moderne & ergonomique** : utilisé quotidiennement par de nombreux employés
- **Data-driven** : chaque décision marketing est guidée par des métriques précises
- **Scalable** : pensé pour accueillir de nouveaux canaux (Meta ads, TikTok, Twitter/X, Reddit…)

---

## Stack Technique

| Couche | Technologie |
|--------|-------------|
| Frontend | Next.js 16 (App Router) + Tailwind CSS 4 |
| Backend / BDD | Supabase (PostgreSQL + Auth + Storage) |
| Hébergement | Vercel |
| Repo | https://github.com/Nepturr/majest |

---

## Architecture de données (Supabase)

### Table `profiles`
Extension de `auth.users`. Champs : `id` (FK auth), `email`, `full_name`, `role` (admin/user), `allowed_pages` (text[]).
RLS : chaque user lit uniquement son propre profil. Toutes les opérations admin passent par le service_role.

### Table `models`
Un persona AI avec une apparence physique fixe définie par un LoRA.
Champs : `id`, `name`, `avatar_url`, `persona`, `lora_id`, `brand_notes`, `status` (active/inactive), `created_at`, `updated_at`.
RLS : tout utilisateur authentifié peut lire. Écriture via service_role uniquement.

### Table `accounts`
Lien entre un compte OnlyFans (OFAPI) et une modèle. Géré dans Admin → onglet Models → colonne "OF Accounts".
Champs clés : `id`, `model_id` (FK → models), `ofapi_account_id` (unique — ex: `acct_XXXXXXXX`), `of_username`, `of_avatar_url`, `status`.
Contrainte : **1 compte OF = 1 seule modèle** (unique sur `ofapi_account_id`).

### Table `instagram_accounts`
Un compte Instagram géré par l'agence. Connecte tous les éléments du funnel de conversion.
Champs clés :
- `id`, `status` (active/inactive), `niche`, `instagram_handle`
- `model_id` (FK → models) — modèle associée
- `of_account_id` (FK → accounts, nullable) — compte OF lié. **1 compte OF peut être lié à plusieurs comptes IG** (pas de contrainte unique ici)
- `oneup_social_network_id` (unique) — `social_account_id` retourné par `listsocialaccounts` OneUp. Identifie le compte dans OneUp pour le scheduling.
- `oneup_social_network_name` — username Instagram (`bh.suki`)
- `oneup_category_id` — stocké pour scheduling futur (peut être vide si compte non catégorisé)
- `get_my_social_link_id` (unique) — `_id` du lien bio GetMySocial. **1 lien GMS = 1 compte IG max**
- `get_my_social_link_name` — `displayName` du lien GMS (ex: `"@bh.suki"`)
- `of_tracking_link_id` (unique) — `id` (numérique, stringifié) du tracking link OFAPI. **1 tracking link = 1 compte IG max**
- `of_tracking_link_url` — `campaignUrl` du tracking link (ex: `https://onlyfans.com/suki.shy/c69`)

### Table `settings`
Stockage clé-valeur pour les clés API. Accessible uniquement via service_role (aucune RLS publique).
Clés utilisées : `gms_api_key`, `ofapi_api_key`, `oneup_api_key`, `apify_api_key`.

### Table `instagram_account_snapshots`
Snapshot des métriques d'un compte Instagram à chaque collecte Apify. Permet de tracer l'évolution dans le temps.
Champs : `id`, `instagram_account_id` (FK → instagram_accounts), `followers_count`, `following_count`, `posts_count`, `bio`, `is_verified`, `profile_pic_url`, `apify_run_id`, `collected_at`.
Index : `(instagram_account_id, collected_at DESC)`.

### Table `instagram_posts`
Structure invariante d'un post/reel Instagram (ne change pas dans le temps). Identifié par son `shortcode`.
Champs : `id`, `instagram_account_id` (FK → instagram_accounts), `shortcode` (unique), `post_type` (Image/Video/Sidecar), `url`, `caption`, `thumbnail_url`, `posted_at`, `first_seen_at`, `updated_at`.
Index : `(instagram_account_id, posted_at DESC)`.

### Table `instagram_post_snapshots`
Métriques d'un post à un instant T. Permet de tracer l'évolution des performances (likes, views, plays).
Champs : `id`, `post_id` (FK → instagram_posts), `likes_count`, `comments_count`, `views_count`, `plays_count`, `apify_run_id`, `collected_at`.
Index : `(post_id, collected_at DESC)`.

---

## APIs externes

### Apify (apify.com)
- Base URL : `https://api.apify.com/v2`
- Auth : query param `?token={apify_api_key}` (stockée dans `settings.apify_api_key`)
- Actor utilisé : `apify~instagram-scraper`
- Usage : scraping Instagram — métriques de profil (followers, following, posts count) et métriques de posts (likes, comments, views, plays)
- **Endpoints utilisés dans Majest :**
  - `GET /v2/users/me?token=...` — test de connexion → retourne `{ data: { username, plan } }`. Test : `GET /api/admin/apify/test`
  - `POST /v2/acts/apify~instagram-scraper/runs?token=...` — lance un run asynchrone. Input : `{ directUrls, resultsType: "details", resultsLimit, proxy }`. Retourne : `{ data: { id (runId), status, defaultDatasetId } }`
  - `GET /v2/acts/apify~instagram-scraper/runs/{runId}?token=...` — statut d'un run. `status` ∈ `READY | RUNNING | SUCCEEDED | FAILED | TIMED-OUT | ABORTED`
  - `GET /v2/datasets/{datasetId}/items?token=...&clean=true&format=json` — récupère les résultats du scrape. Pour `resultsType: "details"`, retourne un tableau d'objets `ApifyInstagramProfile` (voir type dans la route collect)
- **Flow de collecte :**
  1. `POST /api/instagram/{igAccountId}/collect` → lance le run Apify, retourne `{ runId, status, datasetId }`
  2. Frontend poll `GET /api/instagram/{igAccountId}/collect?runId=xxx` jusqu'à `status === "SUCCEEDED"`
  3. Quand SUCCEEDED : la route parse les données et insère dans `instagram_account_snapshots` + `instagram_posts` + `instagram_post_snapshots`
- **Champs parsés depuis Apify :**
  - Profil : `followersCount`, `followsCount`, `postsCount`, `biography`, `verified`, `profilePicUrlHD`
  - Posts (depuis `latestPosts[]`) : `shortCode`, `type`, `url`, `caption`, `displayUrl`, `timestamp`, `likesCount`, `commentsCount`, `videoViewCount`, `videoPlayCount`

### OneUp (oneupapp.io)
- Base URL : `https://www.oneupapp.io/api`
- Auth : query param `?apiKey={oneup_api_key}` (stockée dans `settings.oneup_api_key`)
- Usage : scheduling de posts Instagram (Reels, images, stories)
- **Endpoints utilisés dans Majest :**
  - `GET /api/listcategory?apiKey=...` — liste les catégories (test de connexion → `GET /api/admin/oneup/test`)
  - `GET /api/listsocialaccounts?apiKey=...` — liste TOUS les comptes connectés. Retourne : `{ username, social_account_id, full_name, is_expired, social_network_type, need_refresh }`. **C'est `social_account_id` qui est stocké comme `oneup_social_network_id`** (pas `social_network_id` de `listcategoryaccount`). Filtré sur `social_network_type === "instagram"` (casse insensible).
  - `GET /api/listcategoryaccount?apiKey=...&category_id=ID` — retourne les comptes d'une catégorie avec `social_network_id` (utile pour le scheduling futur)
  - `POST /api/schedulevideopost` — schedule un Reel. Params : `category_id`, `social_network_id` (JSON array ou `"ALL"`), `scheduled_date_time` (YYYY-MM-DD HH:MM), `content`, `video_url`. Instagram : `instagram={"isTrialReel":1|2}`
  - `POST /api/scheduleimagepost` — schedule un post image. Param : `image_url` (plusieurs séparées par `~~`). Instagram : `instagram={"isStory":true}`
  - `GET /api/getscheduledposts?apiKey=...&start=0` — posts programmés (50/page)
  - `GET /api/getpublishedposts?apiKey=...&start=0` — historique publiés
  - `GET /api/getfailedposts?apiKey=...&start=0` — posts en échec
- Response générale : `{ message: string, error: boolean, data: [...] }`
- **Note** : OneUp = scheduling uniquement. Stats de performance des Reels → Apify (scraping Instagram Insights).

### OnlyFansAPI (onlyfansapi.com)
- Base URL : `https://app.onlyfansapi.com/api`
- Auth : header `Authorization: Bearer {ofapi_api_key}` (stockée dans `settings.ofapi_api_key`)
- Système de crédits : 1 crédit/requête non-cachée, 0 pour cachée
- Les endpoints account-spécifiques sont préfixés `/api/{account_id}/...` (ex: `acct_9fbf64bc58814192bd98e3dea33246a4`)
- **Endpoints utilisés dans Majest :**
  - `GET /api/accounts` — liste tous les comptes OF connectés. Retourne des objets avec `onlyfans_username`, `display_name`, `onlyfans_user_data.avatar` (mapping important, voir `/api/admin/ofapi/accounts`)
  - `GET /api/{account_id}/tracking-links?limit=100` — tracking links d'un compte. Response : `{ data: { list: [...], hasMore: bool }, _pagination: { next_page: url } }`. Chaque item : `{ id (number), campaignName, campaignUrl, campaignCode, subscribersCount, clicksCount, ... }`. **Pagination** : boucler sur `_pagination.next_page` tant que `data.hasMore === true`.
  - `GET /api/{account_id}/earning-statistics` — revenue total + time series
  - `GET /api/{account_id}/fans/latest` — derniers subscribers
  - `GET /api/{account_id}/fans/active` — subscribers actifs
- Response structure : `{ data: {...}, _meta: { _credits, _cache, _rate_limits }, _pagination?: { next_page } }`
- Test de connexion : `GET /api/admin/ofapi/test` → appelle `GET /api/client-sessions`

### GetMySocial API v2
- Base URL : `https://getmysocial.com`
- Auth : header `x-api-key: {gms_api_key}` (stockée dans `settings.gms_api_key`)
- **Endpoints utilisés dans Majest :**
  - `GET /api/v2/links?page=N&limit=100` — liste paginée des liens bio. Response : `{ success, data: [...], meta }`. Chaque item : `{ _id, displayName, originalLink (slug), typeLink, createdAt, clicks }`. **`_id` = `get_my_social_link_id`**, **`displayName` = nom affiché** (ex: `"@bh.suki"`), URL reconstituée : `gms.link/{originalLink}`. **Pagination** : boucler sur `?page=N` tant que `pageLinks.length === limit` ou que `meta.totalPages` n'est pas atteint.
  - `GET /api/v2/analytics/overview?scope=link&linkId={id}` — totalClicks, uniqueVisitors, top countries/devices/referrers
  - `GET /api/v2/analytics/dimensions/countries?scope=link&linkId={id}` — breakdown pays (pour Tier 1 %)
  - `GET /api/v2/analytics/time-series?scope=link&linkId={id}&interval=day` — clics par jour
- Tier 1 = pays : US, UK, CA, AU, DE, FR (calculé en % depuis les données countries)
- Toutes les calls GMS se font côté serveur. Test de connexion : `GET /api/admin/gms/test`

---

## Routes API internes (Next.js)

### Admin — Clés API (`/api/admin/settings`)
- `GET ?keys=gms_api_key,ofapi_api_key,oneup_api_key` — récupère les valeurs (service_role)
- `POST { key, value }` — upsert une clé

### Admin — Test de connexion
- `GET /api/admin/gms/test` — teste la clé GMS (appelle `/api/v2/links?limit=1`)
- `GET /api/admin/ofapi/test` — teste la clé OFAPI (appelle `/api/client-sessions`)
- `GET /api/admin/oneup/test` — teste la clé OneUp (appelle `/api/listcategory`)
- `GET /api/admin/apify/test` — teste la clé Apify (appelle `/v2/users/me`). Retourne `{ ok, username, plan }`

### Admin — Models (`/api/admin/models`)
- `GET` — liste toutes les modèles
- `POST { name, avatar_url, persona, lora_id, brand_notes, status }` — crée une modèle
- `PATCH /[id]` — met à jour
- `DELETE /[id]` — supprime

### Admin — OF Accounts liés aux modèles (`/api/admin/accounts`)
- `GET ?model_id=X` — liste les comptes OF (filtrables par modèle)
- `POST { model_id, ofapi_account_id, of_username, of_avatar_url }` — lie un compte OF à une modèle
- `DELETE /[id]` — délie un compte

### Admin — Comptes Instagram (`/api/admin/instagram-accounts`)
- `GET` — liste tous les comptes Instagram avec joins (`model`, `of_account`)
- `POST { model_id, of_account_id, instagram_handle, oneup_social_network_id, oneup_social_network_name, oneup_category_id, get_my_social_link_id, get_my_social_link_name, of_tracking_link_id, of_tracking_link_url, niche, status }` — crée un compte
- `PATCH /[id]` — met à jour
- `DELETE /[id]` — supprime
- Unicité DB : `oneup_social_network_id`, `get_my_social_link_id`, `of_tracking_link_id`

### Instagram Analytics (`/api/instagram/[id]/`)
- `POST /api/instagram/[id]/collect` — lance un run Apify asynchrone pour le compte IG `id`. Retourne `{ runId, status, datasetId }`.
- `GET /api/instagram/[id]/collect?runId=xxx` — vérifie le statut d'un run Apify. Si `SUCCEEDED`, parse et stocke les données dans les 3 tables analytics. Retourne `{ runId, status, snapshotSaved, postsSaved, finishedAt }`.
- `GET /api/instagram/[id]/snapshots?limit=90` — liste l'historique des snapshots de compte (évolution followers etc.), triés du plus récent au plus ancien.
- `GET /api/instagram/[id]/posts?limit=30&type=Video` — liste les posts avec le dernier snapshot de métriques joint.

### Proxies API externes
- `GET /api/admin/oneup/social-accounts` — retourne les comptes Instagram OneUp (via `listsocialaccounts`, filtre `social_network_type = instagram`), avec flag `isAssigned`
- `GET /api/admin/gms/links` — retourne tous les liens GMS paginés, avec flag `isAssigned`
- `GET /api/admin/ofapi/accounts` — retourne les comptes OF depuis OFAPI, enrichis avec `isAssigned` et `assignedToModelName`
- `GET /api/admin/ofapi/tracking-links?account_id=acct_XXX` — retourne tous les tracking links d'un compte OF (pagination complète via `hasMore`/`next_page`), avec flag `isAssigned`
- `GET /api/admin/debug` — route de debug : retourne les réponses brutes OneUp + GMS pour inspecter la structure des champs

---

## Pages et navigation

| Page | Route | Accès | Description |
|------|-------|-------|-------------|
| Dashboard | `/` | Tous | KPIs globaux |
| Accounts | `/accounts` | Tous | Gestion comptes Instagram |
| Instagram Reels | `/instagram` | Tous | Analyser des Reels |
| Performance | `/performance` | Tous | Métriques de performance |
| Admin | `/admin` | Admin seulement | Users, Models, API keys |

La sidebar affiche uniquement les pages autorisées pour l'utilisateur connecté (`allowed_pages` dans `profiles`). Les admins voient tout. La page Models n'est **pas** dans la sidebar — accessible uniquement via Admin panel.

---

## Funnel de conversion (architecture)

```
Instagram Reel
    ↓ (follower clique sur profil)
Bio Instagram
    ↓ (clique sur lien bio)
Landing page GetMySocial   ← tracké via get_my_social_link_id (GMS analytics)
    ↓ (clique sur bouton OF)
Tracking link OnlyFans     ← tracké via of_tracking_link_id (OFAPI tracking-links)
    ↓
Abonnement OnlyFans        ← subscribers + revenue via OFAPI
```

Chaque compte Instagram (`instagram_accounts`) connecte :
1. Un compte OneUp → pour scheduler le contenu
2. Un lien GMS → pour mesurer les clics bio (qualité audience, Tier 1 %)
3. Un tracking link OFAPI → pour mesurer conversions & revenue

---

## Modules

### 1. Dashboard (v0.1)
- Vue d'ensemble des KPIs globaux

### 2. Instagram Reels Analyzer (v0.1)
- Analyse de composition de Reels (hook, structure, audio, CTA, score)

### 3. Admin Panel (v0.2+)
- Onglet **Users** : créer/gérer les utilisateurs et leurs permissions
- Onglet **Models** : CRUD modèles, upload avatar + LoRA, liaison comptes OF (stacked avatars)
- Onglet **API** : configurer et tester les clés GMS, OnlyFansAPI, OneUp

### 4. Accounts (v0.3)
- Page complète de gestion des comptes Instagram
- Modal "Add/Edit Account" avec pickers searchables pour OneUp, GMS, modèle, OF account, tracking link

---

## Historique des Mises à Jour

### v0.4.0 — 25 Mars 2026
- Intégration Apify Instagram API : clé dans Admin → API (carte Apify + test connexion)
- DB : 3 nouvelles tables pour les analytics Instagram avec évolution temporelle
  - `instagram_account_snapshots` : métriques profil (followers, following, posts count) par collecte
  - `instagram_posts` : structure invariante des posts/reels (shortcode, type, caption, date de pub)
  - `instagram_post_snapshots` : métriques de performance d'un post à chaque collecte (likes, comments, views, plays)
- Routes API : collecte async Apify (`POST + GET /api/instagram/[id]/collect`), snapshots compte (`/snapshots`), posts avec métriques (`/posts`)
- Migration SQL : `supabase/migrations/001_instagram_analytics.sql`

### v0.3.x — 25 Mars 2026
- Feature "Accounts" : page `/accounts` complète pour gérer les comptes Instagram
- Modal "Add Account" : le handle vient du picker OneUp (pas saisi manuellement), niche en textarea, GMS en searchable picker
- Pagination complète : GMS (`?page=N&limit=100`) et OFAPI tracking links (`hasMore`/`next_page`)
- Corrections mappings API : OneUp utilise `listsocialaccounts` + `social_account_id`, GMS utilise `displayName`, OFAPI tracking links utilise `data.list` + `campaignName` + `campaignUrl`
- Route debug : `/api/admin/debug` pour inspecter les réponses brutes des APIs

### v0.2.2 — 25 Mars 2026
- Intégration OneUp API : clé dans Admin → API, carte de config, route test

### v0.2.1 — 25 Mars 2026
- Intégrations GetMySocial et OnlyFansAPI : clés dans Admin → API, routes test
- Liaison comptes OF aux modèles (Admin → Models → OF Accounts)
- Stacked avatars OF dans la colonne "OF Accounts" du tableau Models

### v0.2.0 — 25 Mars 2026
- Panel Admin : onglet Models (CRUD), drag-and-drop avatar + LoRA `.safetensors`
- Tables Supabase : `models`, `accounts`, `settings` + RLS
- Types TypeScript : `Model`, `Account`, `OFApiAccount`

### v0.1.0 — 24 Mars 2026
- Initialisation (Next.js 16 + Tailwind + Supabase)
- Layout CRM (sidebar, header, navigation)
- Dashboard + Instagram Reels Analyzer
- Déploiement Vercel — Repo : https://github.com/Nepturr/majest
