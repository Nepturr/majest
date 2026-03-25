-- Ajoute shares_count aux snapshots de posts (réels/carrousels)
alter table public.instagram_post_snapshots
  add column if not exists shares_count int;
