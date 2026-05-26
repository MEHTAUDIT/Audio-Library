-- V6: Add Series entity for grouping related audio/video content
-- Relationship: Series (1) → Audio (many) — each audio belongs to at most one series

CREATE TABLE IF NOT EXISTS series (
                                      id UUID PRIMARY KEY,
                                      name VARCHAR(255) NOT NULL,
    description TEXT,
    cover_image_url VARCHAR(1024),
    speaker VARCHAR(255),
    tenant_id UUID,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

CREATE INDEX IF NOT EXISTS idx_series_tenant ON series (tenant_id);
CREATE INDEX IF NOT EXISTS idx_series_name ON series (name);

-- Add FK from audio_files to series
ALTER TABLE audio_files ADD COLUMN IF NOT EXISTS series_id UUID;
ALTER TABLE audio_files ADD COLUMN IF NOT EXISTS series_order INT DEFAULT 0;

-- Add FK constraint (SET NULL on delete so audio isn't lost if series is deleted)
ALTER TABLE audio_files ADD CONSTRAINT fk_audio_series
    FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_audio_files_series ON audio_files (series_id);