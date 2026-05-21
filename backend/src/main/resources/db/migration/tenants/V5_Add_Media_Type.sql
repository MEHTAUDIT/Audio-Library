
ALTER TABLE audio_files ADD COLUMN IF NOT EXISTS media_type VARCHAR(10) DEFAULT 'AUDIO';

CREATE INDEX IF NOT EXISTS idx_audio_files_media_type ON audio_files (media_type);
