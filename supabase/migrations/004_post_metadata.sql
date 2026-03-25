-- ============================================================
-- MajestGPT — Post Metadata (analyse créative des réels)
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

create table if not exists public.instagram_post_metadata (
  id                  uuid        default gen_random_uuid() primary key,
  post_id             uuid        references public.instagram_posts(id) on delete cascade not null unique,

  -- ── VISUEL ──────────────────────────────────────────────────
  outfit              text,                         -- Tenue (texte libre)
  backdrop            text,                         -- Fond / décor (texte libre)
  lighting            text,                         -- Éclairage
  shot_type           text,                         -- Plan
  duration_seconds    int,                          -- Durée (secondes)
  contrast_level      text,                         -- Contraste modèle/fond

  -- ── HOOK (0-2s) ─────────────────────────────────────────────
  hook_type           text,                         -- Type de hook
  hook_description    text,                         -- Description du hook

  -- ── CONTENU ─────────────────────────────────────────────────
  content_description text,                         -- Description (texte libre)
  energy_level        text,                         -- Énergie
  editing_pace        text,                         -- Rythme de montage

  -- ── AUDIO ────────────────────────────────────────────────────
  music_name          text,                         -- Nom de la musique
  audio_type          text,                         -- Type d'audio

  -- ── TEST & NOTES ─────────────────────────────────────────────
  tested_variable     text,                         -- Variable testée (champ le + important)
  notes               text,                         -- Notes libres

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.instagram_post_metadata enable row level security;

create policy "Authenticated users can manage post metadata"
  on public.instagram_post_metadata for all
  using (auth.uid() is not null);

create index if not exists idx_post_metadata_post_id
  on public.instagram_post_metadata (post_id);

-- Auto-update updated_at
create or replace function public.update_post_metadata_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_post_metadata_updated_at
  before update on public.instagram_post_metadata
  for each row execute function public.update_post_metadata_updated_at();
