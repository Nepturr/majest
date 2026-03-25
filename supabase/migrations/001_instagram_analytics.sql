-- ============================================================
-- MajestGPT — Instagram Analytics Migration
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================


-- ── instagram_account_snapshots ──────────────────────────────
-- Snapshot des métriques d'un compte IG à chaque collecte Apify.
-- Permet de tracer l'évolution (followers, following, posts) au fil du temps.
create table if not exists public.instagram_account_snapshots (
  id                    uuid        default gen_random_uuid() primary key,
  instagram_account_id  uuid        references public.instagram_accounts(id) on delete cascade not null,
  followers_count       int,
  following_count       int,
  posts_count           int,
  bio                   text,
  is_verified           boolean     not null default false,
  profile_pic_url       text,
  apify_run_id          text,        -- ID du run Apify source (pour audit)
  collected_at          timestamptz not null default now()
);

alter table public.instagram_account_snapshots enable row level security;

create policy "Authenticated users can view ig account snapshots"
  on public.instagram_account_snapshots for select
  using (auth.uid() is not null);

-- Index pour requêtes time-series par compte
create index if not exists idx_ig_account_snapshots_account_time
  on public.instagram_account_snapshots (instagram_account_id, collected_at desc);


-- ── instagram_posts ────────────────────────────────────────────
-- Structure invariante d'un post/reel (ne change pas dans le temps).
-- Un post est identifié par son shortcode Instagram.
create table if not exists public.instagram_posts (
  id                    uuid        default gen_random_uuid() primary key,
  instagram_account_id  uuid        references public.instagram_accounts(id) on delete cascade not null,
  shortcode             text        unique not null,  -- ex: B1a2b3c4d5E
  post_type             text        not null default 'Image'
                          check (post_type in ('Image', 'Video', 'Sidecar')),
  url                   text,                         -- https://www.instagram.com/p/{shortcode}/
  caption               text,
  thumbnail_url         text,
  posted_at             timestamptz,                  -- date de publication originale
  first_seen_at         timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.instagram_posts enable row level security;

create policy "Authenticated users can view ig posts"
  on public.instagram_posts for select
  using (auth.uid() is not null);

-- Index pour lister les posts d'un compte par date de publication
create index if not exists idx_ig_posts_account_posted
  on public.instagram_posts (instagram_account_id, posted_at desc);

create trigger on_ig_post_updated
  before update on public.instagram_posts
  for each row execute procedure public.handle_updated_at();


-- ── instagram_post_snapshots ───────────────────────────────────
-- Métriques d'un post à un instant T.
-- Permet de tracer l'évolution des performances (likes, views, plays) dans le temps.
create table if not exists public.instagram_post_snapshots (
  id              uuid        default gen_random_uuid() primary key,
  post_id         uuid        references public.instagram_posts(id) on delete cascade not null,
  likes_count     int,
  comments_count  int,
  views_count     int,        -- vues vidéo (Video/Reel)
  plays_count     int,        -- plays cumulés (Reel)
  apify_run_id    text,        -- ID du run Apify source
  collected_at    timestamptz not null default now()
);

alter table public.instagram_post_snapshots enable row level security;

create policy "Authenticated users can view ig post snapshots"
  on public.instagram_post_snapshots for select
  using (auth.uid() is not null);

-- Index pour time-series par post
create index if not exists idx_ig_post_snapshots_post_time
  on public.instagram_post_snapshots (post_id, collected_at desc);

-- Index pour récupérer le dernier snapshot d'une liste de posts
create index if not exists idx_ig_post_snapshots_post_latest
  on public.instagram_post_snapshots (post_id, collected_at desc);
