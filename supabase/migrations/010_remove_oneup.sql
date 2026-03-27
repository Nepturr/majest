-- Remove OneUp columns from instagram_accounts
ALTER TABLE instagram_accounts
  DROP COLUMN IF EXISTS oneup_social_network_id,
  DROP COLUMN IF EXISTS oneup_social_network_name,
  DROP COLUMN IF EXISTS oneup_category_id;

-- Remove the oneup_api_key setting if it exists
DELETE FROM settings WHERE key = 'oneup_api_key';
