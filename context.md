# MajestGPT — Context & Vision

## Vision

MajestGPT est le CRM interne de l'agence OnlyFans **Majest**. Son objectif principal est de **maximiser la performance marketing** des modèles gérés par l'agence, en commençant par **Instagram** (analyse de Reels).

L'outil doit être :
- **Moderne & ergonomique** : utilisé quotidiennement par de nombreux employés
- **Data-driven** : chaque décision marketing est guidée par des métriques précises
- **Scalable** : pensé pour accueillir de nouveaux canaux (TikTok, Twitter/X, Reddit…)

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

## Historique des Mises à Jour

### v0.1.0 — 24 Mars 2026
- Initialisation du projet (Next.js 16 + Tailwind + Supabase)
- Création du layout CRM (sidebar, header, navigation)
- Dashboard avec statistiques
- Module Instagram Reels Analyzer (analyse de composition)
- Déploiement Vercel configuré
- Repo GitHub : https://github.com/Nepturr/majest
