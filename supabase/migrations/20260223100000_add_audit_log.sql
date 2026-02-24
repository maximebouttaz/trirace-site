CREATE TABLE IF NOT EXISTS admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  race_id BIGINT,
  race_name TEXT,
  race_city TEXT,
  admin_id UUID REFERENCES auth.users(id),
  admin_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
