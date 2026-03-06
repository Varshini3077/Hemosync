-- migrate:up
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

-- migrate:down
DROP TABLE IF EXISTS analytics_events;
