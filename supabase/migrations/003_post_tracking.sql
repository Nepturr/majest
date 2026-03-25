-- ============================================================
-- MajestGPT — Post Tracking
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Ajout du suivi d'activité sur les posts.
-- • is_active   : false si le post a été supprimé manuellement ou détecté comme disparu
-- • last_seen_at: mis à jour à chaque sync Apify. Si trop vieux → post potentiellement supprimé.

alter table public.instagram_posts
  add column if not exists is_active    boolean     not null default true,
  add column if not exists last_seen_at timestamptz not null default now();

create index if not exists idx_instagram_posts_last_seen
  on public.instagram_posts (instagram_account_id, last_seen_at desc);
