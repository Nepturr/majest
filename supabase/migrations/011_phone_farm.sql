-- Phone groups (logical grouping in Majest, independent from iMouseXP internal groups)
CREATE TABLE phone_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Phones registered in Majest (mirrors iMouseXP devices via MAC address)
CREATE TABLE phones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text UNIQUE NOT NULL,       -- MAC address (iMouseXP "id" field)
  label text NOT NULL,
  group_id uuid REFERENCES phone_groups(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  sort_order int NOT NULL DEFAULT 0,
  width int,                            -- phone logical screen width (e.g. 390)
  height int,                           -- phone logical screen height (e.g. 844)
  model text,                           -- e.g. "iPhone 14 Pro"
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Phone access permissions
-- A user can have access to individual phones OR entire groups
CREATE TABLE phone_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  phone_id uuid REFERENCES phones(id) ON DELETE CASCADE,
  group_id uuid REFERENCES phone_groups(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT phone_access_one_target CHECK (
    (phone_id IS NOT NULL AND group_id IS NULL) OR
    (phone_id IS NULL AND group_id IS NOT NULL)
  )
);

-- Unique constraints (partial, handles NULLs correctly)
CREATE UNIQUE INDEX phone_access_user_phone_idx ON phone_access (user_id, phone_id) WHERE phone_id IS NOT NULL;
CREATE UNIQUE INDEX phone_access_user_group_idx ON phone_access (user_id, group_id) WHERE group_id IS NOT NULL;

-- Mini PC IP address (stored in settings table)
INSERT INTO settings (key, value) VALUES ('mini_pc_ip', '') ON CONFLICT (key) DO NOTHING;
