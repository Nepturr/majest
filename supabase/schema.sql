-- ============================================================
-- MajestGPT — Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. PROFILES TABLE
-- Extends auth.users with role and page permissions
create table if not exists public.profiles (
  id            uuid        references auth.users(id) on delete cascade primary key,
  email         text        not null,
  full_name     text,
  role          text        not null default 'user' check (role in ('admin', 'user')),
  allowed_pages text[]      not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 2. ENABLE RLS
alter table public.profiles enable row level security;

-- 3. SECURITY DEFINER FUNCTION
-- Bypasses RLS to check if current user is admin (prevents infinite recursion)
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- 4. RLS POLICIES
-- Browser client: users can only read their own profile (simple, no recursion)
-- All admin operations (list users, update, delete) go through API routes
-- using the service_role key which bypasses RLS entirely.
create policy "Users can view own profile"
  on public.profiles for select
  using (id = auth.uid());

-- 5. UPDATED_AT TRIGGER
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_profile_updated
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();


-- ============================================================
-- BOOTSTRAP: Create your first admin profile
--
-- After creating a user in Supabase Dashboard → Authentication → Users,
-- run this query in the SQL Editor (replace the email):
-- ============================================================

insert into public.profiles (id, email, full_name, role, allowed_pages)
select
  id,
  email,
  coalesce(raw_user_meta_data->>'full_name', split_part(email, '@', 1)) as full_name,
  'admin' as role,
  '{}' as allowed_pages
from auth.users
where email = 'VOTRE_EMAIL_ICI'
on conflict (id) do update set role = 'admin';
