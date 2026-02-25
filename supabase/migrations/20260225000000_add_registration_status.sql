ALTER TABLE races ADD COLUMN IF NOT EXISTS registration_status text;
-- Possible values: 'open', 'sold_out', 'closed', null
