-- ============================================================
-- MajestGPT — Ajout durée vidéo sur instagram_posts
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

alter table public.instagram_posts
  add column if not exists video_duration int; -- durée en secondes (réels/vidéos, depuis Apify)
