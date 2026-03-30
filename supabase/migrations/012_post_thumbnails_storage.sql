-- Migration 012: Supabase Storage bucket for post thumbnails
-- Stores cached thumbnail images permanently (CDN URLs expire after 24-48h)

insert into storage.buckets (id, name, public)
  values ('post-thumbnails', 'post-thumbnails', true)
  on conflict (id) do nothing;

-- Allow anyone to read (public bucket)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and policyname = 'public-read-post-thumbnails'
  ) then
    execute $p$
      create policy "public-read-post-thumbnails"
        on storage.objects
        for select
        to public
        using (bucket_id = 'post-thumbnails')
    $p$;
  end if;
end $$;
