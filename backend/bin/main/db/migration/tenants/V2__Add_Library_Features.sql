-- Robust tenant-scoped schema additions to support:
-- playlists, favorites, speakers, metadata, listening history, notifications, recommendations

-- 1) Speakers
CREATE TABLE IF NOT EXISTS speakers (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    bio TEXT,
    avatar_url VARCHAR(1024),
    website_url VARCHAR(1024),
    tenant_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_speakers_tenant ON speakers (tenant_id);
CREATE INDEX IF NOT EXISTS idx_speakers_name ON speakers (name);

-- 2) Audio enhancements (filtering by date/time, publication lifecycle)
ALTER TABLE audio_files ADD COLUMN IF NOT EXISTS published_at TIMESTAMP;
ALTER TABLE audio_files ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMP;
ALTER TABLE audio_files ADD COLUMN IF NOT EXISTS recorded_timezone VARCHAR(64);
ALTER TABLE audio_files ADD COLUMN IF NOT EXISTS status VARCHAR(30);

CREATE INDEX IF NOT EXISTS idx_audio_files_published_at ON audio_files (published_at);
CREATE INDEX IF NOT EXISTS idx_audio_files_recorded_at ON audio_files (recorded_at);
CREATE INDEX IF NOT EXISTS idx_audio_files_duration ON audio_files (duration_seconds);

-- 3) Audio <-> Speakers (many-to-many)
CREATE TABLE IF NOT EXISTS audio_speakers (
    audio_id UUID NOT NULL,
    speaker_id UUID NOT NULL,
    role VARCHAR(50) DEFAULT 'SPEAKER',
    display_order INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (audio_id, speaker_id),
    CONSTRAINT fk_audio_speakers_audio
        FOREIGN KEY (audio_id) REFERENCES audio_files (id) ON DELETE CASCADE,
    CONSTRAINT fk_audio_speakers_speaker
        FOREIGN KEY (speaker_id) REFERENCES speakers (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audio_speakers_speaker ON audio_speakers (speaker_id);

-- 4) Genres (for recommendations / browsing)
CREATE TABLE IF NOT EXISTS genres (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    tenant_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_genres_tenant_name UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS audio_genres (
    audio_id UUID NOT NULL,
    genre_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (audio_id, genre_id),
    CONSTRAINT fk_audio_genres_audio
        FOREIGN KEY (audio_id) REFERENCES audio_files (id) ON DELETE CASCADE,
    CONSTRAINT fk_audio_genres_genre
        FOREIGN KEY (genre_id) REFERENCES genres (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audio_genres_genre ON audio_genres (genre_id);

-- 5) Flexible metadata (key/value)
CREATE TABLE IF NOT EXISTS audio_metadata (
    id UUID PRIMARY KEY,
    audio_id UUID NOT NULL,
    meta_key VARCHAR(100) NOT NULL,
    meta_value TEXT,
    value_type VARCHAR(30),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_audio_metadata_audio_key UNIQUE (audio_id, meta_key),
    CONSTRAINT fk_audio_metadata_audio
        FOREIGN KEY (audio_id) REFERENCES audio_files (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audio_metadata_key ON audio_metadata (meta_key);

-- 6) Playlists
CREATE TABLE IF NOT EXISTS playlists (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    visibility VARCHAR(20) DEFAULT 'PRIVATE',
    tenant_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_playlists_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_playlists_user ON playlists (user_id);

CREATE TABLE IF NOT EXISTS playlist_items (
    id UUID PRIMARY KEY,
    playlist_id UUID NOT NULL,
    audio_id UUID NOT NULL,
    position INT NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    note TEXT,
    CONSTRAINT fk_playlist_items_playlist
        FOREIGN KEY (playlist_id) REFERENCES playlists (id) ON DELETE CASCADE,
    CONSTRAINT fk_playlist_items_audio
        FOREIGN KEY (audio_id) REFERENCES audio_files (id) ON DELETE CASCADE,
    CONSTRAINT uq_playlist_items_playlist_position UNIQUE (playlist_id, position)
);

CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist ON playlist_items (playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_items_audio ON playlist_items (audio_id);

-- 7) Favorites (audios + speakers)
CREATE TABLE IF NOT EXISTS user_favorite_audio (
    user_id UUID NOT NULL,
    audio_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, audio_id),
    CONSTRAINT fk_user_favorite_audio_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_user_favorite_audio_audio
        FOREIGN KEY (audio_id) REFERENCES audio_files (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_favorite_audio_audio ON user_favorite_audio (audio_id);

CREATE TABLE IF NOT EXISTS user_favorite_speaker (
    user_id UUID NOT NULL,
    speaker_id UUID NOT NULL,
    notify_on_new_audio BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, speaker_id),
    CONSTRAINT fk_user_favorite_speaker_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_user_favorite_speaker_speaker
        FOREIGN KEY (speaker_id) REFERENCES speakers (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_favorite_speaker_speaker ON user_favorite_speaker (speaker_id);

-- 8) Listening history (also useful for recommendations + analytics)
CREATE TABLE IF NOT EXISTS listening_history (
    id UUID PRIMARY KEY,
    user_id UUID,
    audio_id UUID NOT NULL,
    client_session_id UUID,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    seconds_listened BIGINT,
    progress_seconds BIGINT,
    source VARCHAR(50),
    tenant_id UUID,
    CONSTRAINT fk_listening_history_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT fk_listening_history_audio
        FOREIGN KEY (audio_id) REFERENCES audio_files (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_listening_history_user_started ON listening_history (user_id, started_at);
CREATE INDEX IF NOT EXISTS idx_listening_history_audio_started ON listening_history (audio_id, started_at);

-- 9) Notifications (in-app notifications; delivery mechanism is app-level)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255),
    body TEXT,
    payload_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP,
    tenant_id UUID,
    CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications (user_id, read_at);

-- 10) Recommendation cache (optional; can be recomputed anytime)
CREATE TABLE IF NOT EXISTS recommendation_cache (
    user_id UUID NOT NULL,
    audio_id UUID NOT NULL,
    score DOUBLE PRECISION,
    reason VARCHAR(255),
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, audio_id),
    CONSTRAINT fk_recommendation_cache_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_recommendation_cache_audio
        FOREIGN KEY (audio_id) REFERENCES audio_files (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_recommendation_cache_user_generated ON recommendation_cache (user_id, generated_at);


