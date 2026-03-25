-- Ajoute 'Reel' aux valeurs autorisées pour post_type
alter table public.instagram_posts
  drop constraint if exists instagram_posts_post_type_check;

alter table public.instagram_posts
  add constraint instagram_posts_post_type_check
    check (post_type in ('Image', 'Video', 'Reel', 'Sidecar'));
