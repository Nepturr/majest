-- ============================================================
-- MajestGPT — Analytics columns
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- cumulative total views at snapshot time (computed from instagram_post_snapshots)
alter table public.instagram_account_snapshots
  add column if not exists total_views bigint;

-- country breakdown JSON [{ country, count }] from the GMS API
alter table public.gms_overview_snapshots
  add column if not exists country_breakdown jsonb;
