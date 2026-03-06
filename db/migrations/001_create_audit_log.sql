-- migrate:up
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS audit_log (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id     TEXT        NOT NULL,
  event_type     TEXT        NOT NULL,
  hospital_id    TEXT        NOT NULL,
  coordinator_id TEXT        NOT NULL,
  interface      TEXT        NOT NULL,
  blood_type     TEXT,
  units          INTEGER,
  bank_id        TEXT,
  duration_ms    INTEGER,
  metadata       JSONB,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_request_id
  ON audit_log (request_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_hospital_created
  ON audit_log (hospital_id, created_at);

-- migrate:down
DROP TABLE IF EXISTS audit_log;
