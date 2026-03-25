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

-- ============================================================
-- MODELS TABLE
-- Un persona AI avec une apparence physique fixe (LoRA)
-- ============================================================

create table if not exists public.models (
  id          uuid        default gen_random_uuid() primary key,
  name        text        not null,
  avatar_url  text,
  persona     text,
  lora_id     text,
  brand_notes text,
  status      text        not null default 'active' check (status in ('active', 'inactive')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.models enable row level security;

-- Tout utilisateur authentifié peut lire les modèles (sélecteur génération IA)
create policy "Authenticated users can view models"
  on public.models for select
  using (auth.uid() is not null);

-- Seul le service_role (API admin) peut écrire — RLS bypass côté serveur
create trigger on_model_updated
  before update on public.models
  for each row execute procedure public.handle_updated_at();


-- ============================================================
-- ACCOUNTS TABLE
-- Un compte Instagram associé à une modèle
-- (structure préparée pour la feature "Ajouter un compte")
-- ============================================================

create table if not exists public.accounts (
  id                    uuid        default gen_random_uuid() primary key,
  model_id              uuid        references public.models(id) on delete cascade not null,
  ofapi_account_id      text        unique,
  of_username           text,
  of_avatar_url         text,
  instagram_handle      text,
  niche                 text,
  get_my_social_link_id text,
  of_tracking_link      text,
  status                text        not null default 'active' check (status in ('active', 'inactive')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.accounts enable row level security;

create policy "Authenticated users can view accounts"
  on public.accounts for select
  using (auth.uid() is not null);

create trigger on_account_updated
  before update on public.accounts
  for each row execute procedure public.handle_updated_at();


-- ============================================================
-- INSTAGRAM ACCOUNTS TABLE
-- Un compte Instagram géré par l'agence
-- ============================================================

create table if not exists public.instagram_accounts (
  id                        uuid        default gen_random_uuid() primary key,
  model_id                  uuid        references public.models(id) on delete cascade not null,
  of_account_id             uuid        references public.accounts(id) on delete set null,
  instagram_handle          text        not null,
  oneup_social_network_id   text        unique,
  oneup_social_network_name text,
  oneup_category_id         text,
  get_my_social_link_id     text        unique,
  get_my_social_link_name   text,
  of_tracking_link_id       text        unique,
  of_tracking_link_url      text,
  niche                     text,
  status                    text        not null default 'active' check (status in ('active', 'inactive')),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

alter table public.instagram_accounts enable row level security;

create policy "Authenticated users can view instagram accounts"
  on public.instagram_accounts for select
  using (auth.uid() is not null);

create trigger on_instagram_account_updated
  before update on public.instagram_accounts
  for each row execute procedure public.handle_updated_at();


-- ============================================================
-- SETTINGS TABLE
-- Stockage clé-valeur pour les clés API et configs (service_role only)
-- ============================================================

create table if not exists public.settings (
  key        text        primary key,
  value      text        not null,
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;
-- Pas de policy publique : accessible uniquement via service_role (API routes)

create trigger on_settings_updated
  before update on public.settings
  for each row execute procedure public.handle_updated_at();


-- ============================================================
-- BOOTSTRAP: Create your first admin profile
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
