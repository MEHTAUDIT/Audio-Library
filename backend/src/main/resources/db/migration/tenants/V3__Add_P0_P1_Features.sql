-- P0 & P1 Feature additions:
-- P0: User Preferences, Playback Queue
-- P1: Tags System, Language field, Soft Deletes

-- ============================================================================
-- P0: USER PREFERENCES
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY,
    preferred_playback_speed DECIMAL(3,2) DEFAULT 1.0,
    auto_play_next BOOLEAN DEFAULT TRUE,
    email_notifications BOOLEAN DEFAULT TRUE,
    push_notifications BOOLEAN DEFAULT TRUE,
    preferred_language VARCHAR(10),
    preferred_audio_length VARCHAR(20) DEFAULT 'ANY', -- SHORT, MEDIUM, LONG, ANY
    theme VARCHAR(20) DEFAULT 'SYSTEM',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_preferences_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- ============================================================================
-- P0: PLAYBACK QUEUE (Up Next / Continue Listening)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_playback_queue (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    audio_id UUID NOT NULL,
    position INT NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(50), -- MANUAL, AUTO_PLAY, RECOMMENDATION, PLAYLIST
    CONSTRAINT fk_playback_queue_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_playback_queue_audio
        FOREIGN KEY (audio_id) REFERENCES audio_files (id) ON DELETE CASCADE,
    CONSTRAINT uq_playback_queue_user_position UNIQUE (user_id, position)
);

CREATE INDEX IF NOT EXISTS idx_playback_queue_user ON user_playback_queue (user_id, position);

-- Resume point columns on users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_played_audio_id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_played_position_seconds BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_played_at TIMESTAMP;

-- ============================================================================
-- P1: TAGS SYSTEM
-- ============================================================================
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(7), -- Hex color for UI, e.g. #FF5733
    usage_count BIGINT DEFAULT 0,
    tenant_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tags_tenant_slug UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_tags_tenant ON tags (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags (name);
CREATE INDEX IF NOT EXISTS idx_tags_usage ON tags (tenant_id, usage_count DESC);

CREATE TABLE IF NOT EXISTS audio_tags (
    audio_id UUID NOT NULL,
    tag_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (audio_id, tag_id),
    CONSTRAINT fk_audio_tags_audio
        FOREIGN KEY (audio_id) REFERENCES audio_files (id) ON DELETE CASCADE,
    CONSTRAINT fk_audio_tags_tag
        FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audio_tags_tag ON audio_tags (tag_id);

-- ============================================================================
-- P1: LANGUAGE SUPPORT
-- ============================================================================
ALTER TABLE audio_files ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en';
ALTER TABLE audio_files ADD COLUMN IF NOT EXISTS has_transcript BOOLEAN DEFAULT FALSE;
ALTER TABLE audio_files ADD COLUMN IF NOT EXISTS transcript_url VARCHAR(1024);

CREATE INDEX IF NOT EXISTS idx_audio_files_language ON audio_files (language);

-- ============================================================================
-- P1: SOFT DELETES
-- ============================================================================
ALTER TABLE audio_files ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE speakers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE tags ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Partial indexes for active records (PostgreSQL syntax)
-- These dramatically speed up queries that filter out deleted records
CREATE INDEX IF NOT EXISTS idx_audio_files_active 
    ON audio_files (tenant_id, published_at) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_playlists_active 
    ON playlists (user_id) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_speakers_active 
    ON speakers (tenant_id) 
    WHERE deleted_at IS NULL;


