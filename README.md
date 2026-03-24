# MajestGPT

CRM interne de l'agence **Majest** — optimisé pour la performance marketing sur Instagram.

## Stack

- **Frontend** : Next.js 16 (App Router) + Tailwind CSS 4
- **Backend** : Supabase (PostgreSQL + Auth)
- **Hébergement** : Vercel
- **Icons** : Lucide React

## Fonctionnalités

- **Dashboard** — Vue d'ensemble des KPIs et performances
- **Instagram Reels Analyzer** — Décomposition exacte de la structure d'un Reel (hook, segments, audio, overlays, CTA)
- **Gestion des Modèles** — Suivi des comptes et scores
- **Performance** — Métriques marketing et recommandations

## Setup local

```bash
# Cloner le repo
git clone https://github.com/Nepturr/majest.git
cd majest

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env.local
# Éditer .env.local avec vos clés Supabase

# Lancer en dev
npm run dev
```

## Déploiement

Le projet est déployé automatiquement sur **Vercel** à chaque push sur `main`.

## Documentation

Voir [context.md](./context.md) pour la vision du projet et l'historique des mises à jour.
