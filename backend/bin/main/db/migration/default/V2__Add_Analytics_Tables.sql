-- Public/global schema tables for cross-tenant analytics.
-- Domain data remains in tenant schemas; events can be emitted into this shared table
-- with tenant_id as the partition key.

CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    user_id UUID,
    session_id UUID,
    event_type VARCHAR(50) NOT NULL,
    occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    audio_id UUID,
    speaker_id UUID,
    playlist_id UUID,
    properties_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_tenant_time ON analytics_events (tenant_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_tenant_type_time ON analytics_events (tenant_id, event_type, occurred_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_tenant_audio ON analytics_events (tenant_id, audio_id);

-- Optional rollup table for fast dashboards (can be populated by scheduled jobs)
CREATE TABLE IF NOT EXISTS analytics_daily_audio (
    day DATE NOT NULL,
    tenant_id UUID NOT NULL,
    audio_id UUID NOT NULL,
    plays BIGINT DEFAULT 0,
    listeners BIGINT DEFAULT 0,
    total_seconds_listened BIGINT DEFAULT 0,
    PRIMARY KEY (day, tenant_id, audio_id)
);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_audio_tenant_day ON analytics_daily_audio (tenant_id, day);


