-- =============================================================================
-- HemoSync — Canonical PostgreSQL Schema
-- Audit + analytics store (operational data lives in Cosmos DB)
-- =============================================================================

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- audit_log
-- Every significant event in the blood request lifecycle
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id     TEXT        NOT NULL,
  event_type     TEXT        NOT NULL, -- REQUEST_CREATED, BROADCAST_SENT, CONFIRMED, FAILED, DONOR_QUERIED
  hospital_id    TEXT        NOT NULL,
  coordinator_id TEXT        NOT NULL,
  interface      TEXT        NOT NULL, -- TEAMS, WHATSAPP, WEB
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

-- -----------------------------------------------------------------------------
-- donor_outreach_history
-- Tracks every donor contacted during a fallback search
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS donor_outreach_history (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id     TEXT        NOT NULL,
  donor_id       TEXT        NOT NULL,
  hospital_id    TEXT        NOT NULL,
  blood_type     TEXT        NOT NULL,
  contacted_at   TIMESTAMPTZ DEFAULT NOW(),
  outcome        TEXT,        -- DONATED, DECLINED, NO_RESPONSE
  notes          TEXT
);

CREATE INDEX IF NOT EXISTS idx_donor_outreach_request_id
  ON donor_outreach_history (request_id);

-- -----------------------------------------------------------------------------
-- analytics_events
-- Generic event stream for Power BI and Application Insights dashboards
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name  TEXT        NOT NULL,
  properties  JSONB,
  session_id  TEXT,
  user_id     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_name_created
  ON analytics_events (event_name, created_at);
