-- Add file_hash column for duplicate detection during upload
-- SHA-256 hash of file content, used to prevent importing the same file twice

ALTER TABLE audio_files ADD COLUMN file_hash VARCHAR(64);

CREATE INDEX idx_audio_files_file_hash ON audio_files(file_hash);