ALTER TABLE playlists ADD COLUMN IF NOT EXISTS share_token VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS idx_playlists_share_token
    ON playlists (share_token)
    WHERE share_token IS NOT NULL;
