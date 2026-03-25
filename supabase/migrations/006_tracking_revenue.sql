-- ============================================================
-- MajestGPT — Revenue OFAPI sur tracking_link_snapshots
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

alter table public.tracking_link_snapshots
  add column if not exists revenue_total        numeric(12,2),  -- revenus cumulatifs (€/$)
  add column if not exists revenue_per_subscriber numeric(10,2); -- LTV = revenu moyen par sub
