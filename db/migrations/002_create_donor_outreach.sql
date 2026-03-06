-- migrate:up
CREATE TABLE IF NOT EXISTS donor_outreach_history (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id     TEXT        NOT NULL,
  donor_id       TEXT        NOT NULL,
  hospital_id    TEXT        NOT NULL,
  blood_type     TEXT        NOT NULL,
  contacted_at   TIMESTAMPTZ DEFAULT NOW(),
  outcome        TEXT,
  notes          TEXT
);

CREATE INDEX IF NOT EXISTS idx_donor_outreach_request_id
  ON donor_outreach_history (request_id);

-- migrate:down
DROP TABLE IF EXISTS donor_outreach_history;
