CREATE TABLE IF NOT EXISTS playlist_share_links (
    id UUID PRIMARY KEY,
    token VARCHAR(255) UNIQUE NOT NULL,
    tenant_id UUID NOT NULL,
    tenant_schema VARCHAR(255) NOT NULL,
    playlist_id UUID NOT NULL,
    active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_playlist_share_links_token_active
    ON playlist_share_links (token, active);

CREATE INDEX IF NOT EXISTS idx_playlist_share_links_playlist_active
    ON playlist_share_links (playlist_id, active);
