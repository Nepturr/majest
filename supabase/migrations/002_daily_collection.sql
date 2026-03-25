-- ============================================================
-- MajestGPT — Daily Collection Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================


-- ── gms_daily_stats ────────────────────────────────────────────
-- Clicks par jour par lien GMS (depuis l'API time-series GMS).
-- Permet de calculer les clics sur n'importe quelle période (today, week, month).
create table if not exists public.gms_daily_stats (
  id                    uuid    default gen_random_uuid() primary key,
  instagram_account_id  uuid    references public.instagram_accounts(id) on delete cascade not null,
  date                  date    not null,
  clicks                int     not null default 0,
  unique_visitors       int,
  constraint gms_daily_stats_account_date_unique unique (instagram_account_id, date)
);

alter table public.gms_daily_stats enable row level security;

create policy "Authenticated users can view gms daily stats"
  on public.gms_daily_stats for select
  using (auth.uid() is not null);

create index if not exists idx_gms_daily_stats_account_date
  on public.gms_daily_stats (instagram_account_id, date desc);


-- ── gms_overview_snapshots ─────────────────────────────────────
-- Snapshot cumulatif GMS (total clicks, Tier 1 %) — une fois par collecte.
-- Sert pour afficher le Tier 1 % cumulatif.
create table if not exists public.gms_overview_snapshots (
  id                    uuid        default gen_random_uuid() primary key,
  instagram_account_id  uuid        references public.instagram_accounts(id) on delete cascade not null,
  total_clicks          int,
  unique_visitors       int,
  tier1_pct             int,
  collected_at          timestamptz not null default now()
);

alter table public.gms_overview_snapshots enable row level security;

create policy "Authenticated users can view gms overview snapshots"
  on public.gms_overview_snapshots for select
  using (auth.uid() is not null);

create index if not exists idx_gms_overview_snapshots_account_time
  on public.gms_overview_snapshots (instagram_account_id, collected_at desc);


-- ── tracking_link_snapshots ────────────────────────────────────
-- Snapshot cumulatif OFAPI (clicks + subscribers) — une fois par collecte.
-- Pour calculer un delta sur une période, on compare le dernier snapshot
-- avec le snapshot le plus proche du début de la période.
create table if not exists public.tracking_link_snapshots (
  id                    uuid        default gen_random_uuid() primary key,
  instagram_account_id  uuid        references public.instagram_accounts(id) on delete cascade not null,
  clicks_count          int         not null default 0,
  subscribers_count     int         not null default 0,
  collected_at          timestamptz not null default now()
);

alter table public.tracking_link_snapshots enable row level security;

create policy "Authenticated users can view tracking link snapshots"
  on public.tracking_link_snapshots for select
  using (auth.uid() is not null);

create index if not exists idx_tracking_link_snapshots_account_time
  on public.tracking_link_snapshots (instagram_account_id, collected_at desc);
