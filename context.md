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

## Architecture de données

### Table `models`
Un persona AI avec une apparence physique fixe définie par un LoRA.
Champs : `name`, `avatar_url`, `persona`, `lora_id`, `lora_thumbnail_url`, `brand_notes`, `status` (active/inactive).

### Table `accounts` (préparée, feature à venir)
Un compte Instagram associé à une modèle.
Champs clés : `model_id` (FK), `instagram_handle`, `niche`, `get_my_social_link_id` (GetMySocial API), `of_tracking_link` (OnlyFans tracking).

### Sources de données du funnel
- **GetMySocial** : clics bio → `GET /api/v2/analytics/overview?scope=link&linkId={getMySocialLinkId}`
- **OnlyFans API** (via onlyfansapi.com) : subscribers, revenue, tracking links
- **Apify** : scraping Instagram Insights pour les stats de reels

## Historique des Mises à Jour

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
