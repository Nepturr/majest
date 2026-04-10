-- 013: Assign Instagram accounts to users
-- Adds a uuid array to profiles so admins can restrict
-- which instagram_accounts a given user can see in Performance.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS assigned_instagram_account_ids uuid[] NOT NULL DEFAULT '{}';
