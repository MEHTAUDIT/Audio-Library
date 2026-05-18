package com.audiolibrary.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.flywaydb.core.Flyway;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

@Component
@RequiredArgsConstructor
@Slf4j
public class FlywayConfig {

    private final DataSource dataSource;

    /**
     * Migrates a new tenant schema.
     * Called when a new tenant registers.
     * For local profile, we use Hibernate ddl-auto, so this just creates the schema.
     */
    public void migrateTenant(String schemaName) {
        log.info("Creating tenant schema: {}", schemaName);
        createSchemaIfNotExists(schemaName);
        
        // For non-local environments, run Flyway migrations
        String activeProfile = System.getProperty("spring.profiles.active", "local");
        if (!activeProfile.equals("local")) {
            runFlywayMigration(schemaName);
        } else {
            // For local/H2, create tables directly (simpler than Flyway for in-memory)
            createTenantTables(schemaName);
        }
        
        log.info("Tenant schema {} ready", schemaName);
    }

    private void createSchemaIfNotExists(String schemaName) {
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            // IMPORTANT (H2): unquoted identifiers are uppercased, but our CREATE TABLE statements
            // reference the schema in quotes (case-sensitive). Create the schema quoted as well
            // to ensure the same identifier is used.
            statement.execute("CREATE SCHEMA IF NOT EXISTS \"" + schemaName + "\"");
            log.debug("Schema {} created", schemaName);
        } catch (SQLException e) {
            log.error("Failed to create schema {}: {}", schemaName, e.getMessage());
            throw new RuntimeException("Failed to create schema: " + schemaName, e);
        }
    }

    private void createTenantTables(String schemaName) {
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            
            // Create users table (with P0 resume columns)
            statement.execute(
                "CREATE TABLE IF NOT EXISTS \"" + schemaName + "\".users (" +
                "    id UUID PRIMARY KEY," +
                "    email VARCHAR(255) NOT NULL," +
                "    password_hash VARCHAR(255) NOT NULL," +
                "    first_name VARCHAR(100)," +
                "    last_name VARCHAR(100)," +
                "    role VARCHAR(50) NOT NULL," +
                "    tenant_id UUID," +
                "    last_played_audio_id UUID," +
                "    last_played_position_seconds BIGINT," +
                "    last_played_at TIMESTAMP," +
                "    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
                "    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                ")"
            );
            
            // Create audio_files table (with P1 language + soft delete + file storage)
            statement.execute(
                "CREATE TABLE IF NOT EXISTS \"" + schemaName + "\".audio_files (" +
                "    id UUID PRIMARY KEY," +
                "    title VARCHAR(255) NOT NULL," +
                "    description TEXT," +
                "    s3_key VARCHAR(512)," +
                "    url VARCHAR(1024)," +
                "    storage_key VARCHAR(512)," +
                "    original_filename VARCHAR(255)," +
                "    duration_seconds BIGINT," +
                "    mime_type VARCHAR(50)," +
                "    size_bytes BIGINT," +
                "    published_at TIMESTAMP," +
                "    recorded_at TIMESTAMP," +
                "    recorded_timezone VARCHAR(64)," +
                "    status VARCHAR(30)," +
                "    language VARCHAR(10) DEFAULT 'en'," +
                "    has_transcript BOOLEAN DEFAULT FALSE," +
                "    transcript_url VARCHAR(1024)," +
                "    speaker VARCHAR(255)," +
                "    topic VARCHAR(255)," +
                "    tenant_id UUID," +
                "    deleted_at TIMESTAMP," +
                "    file_hash VARCHAR(64)," +            
                "    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
                "    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                ")"
            );

            // Speakers (with P1 soft delete)
            statement.execute(
                "CREATE TABLE IF NOT EXISTS \"" + schemaName + "\".speakers (" +
                "    id UUID PRIMARY KEY," +
                "    name VARCHAR(255) NOT NULL," +
                "    bio TEXT," +
                "    avatar_url VARCHAR(1024)," +
                "    website_url VARCHAR(1024)," +
                "    tenant_id UUID," +
                "    deleted_at TIMESTAMP," +
                "    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
                "    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                ")"
            );

            // Audio <-> Speakers (many-to-many)
            statement.execute(
                "CREATE TABLE IF NOT EXISTS \"" + schemaName + "\".audio_speakers (" +
                "    audio_id UUID NOT NULL," +
                "    speaker_id UUID NOT NULL," +
                "    role VARCHAR(50) DEFAULT 'SPEAKER'," +
                "    display_order INT," +
                "    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
                "    PRIMARY KEY (audio_id, speaker_id)," +
                "    CONSTRAINT fk_audio_speakers_audio FOREIGN KEY (audio_id) REFERENCES \"" + schemaName + "\".audio_files (id) ON DELETE CASCADE," +
                "    CONSTRAINT fk_audio_speakers_speaker FOREIGN KEY (speaker_id) REFERENCES \"" + schemaName + "\".speakers (id) ON DELETE CASCADE" +
                ")"
            );

            // Genres + Audio genres
            statement.execute(
                "CREATE TABLE IF NOT EXISTS \"" + schemaName + "\".genres (" +
                "    id UUID PRIMARY KEY," +
                "    name VARCHAR(100) NOT NULL," +
                "    tenant_id UUID," +
                "    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
                "    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
                "    CONSTRAINT uq_genres_tenant_name UNIQUE (tenant_id, name)" +
                ")"
            );

            statement.execute(
                "CREATE TABLE IF NOT EXISTS \"" + schemaName + "\".audio_genres (" +
                "    audio_id UUID NOT NULL," +
                "    genre_id UUID NOT NULL," +
                "    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
                "    PRIMARY KEY (audio_id, genre_id)," +
                "    CONSTRAINT fk_audio_genres_audio FOREIGN KEY (audio_id) REFERENCES \"" + schemaName + "\".audio_files (id) ON DELETE CASCADE," +
                "    CONSTRAINT fk_audio_genres_genre FOREIGN KEY (genre_id) REFERENCES \"" + schemaName + "\".genres (id) ON DELETE CASCADE" +
                ")"
            );

            // Flexible audio metadata (key/value)
            statement.execute(
                "CREATE TABLE IF NOT EXISTS \"" + schemaName + "\".audio_metadata (" +
                "    id UUID PRIMARY KEY," +
                "    audio_id UUID NOT NULL," +
                "    meta_key VARCHAR(100) NOT NULL," +
                "    meta_value TEXT," +
                "    value_type VARCHAR(30)," +
                "    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
                "    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
                "    CONSTRAINT uq_audio_metadata_audio_key UNIQUE (audio_id, meta_key)," +
                "    CONSTRAINT fk_audio_metadata_audio FOREIGN KEY (audio_id) REFERENCES \"" + schemaName + "\".audio_files (id) ON DELETE CASCADE" +
                ")"
            );

            // Playlists (with P1 soft delete)
            statement.execute(
                "CREATE TABLE IF NOT EXISTS \"" + schemaName + "\".playlists (" +
                "    id UUID PRIMARY KEY," +
                "    user_id UUID NOT NULL," +
                "    name VARCHAR(255) NOT NULL," +
                "    description TEXT," +
                "    visibility VARCHAR(20) DEFAULT 'PRIVATE'," +
                "    tenant_id UUID," +
                "    deleted_at TIMESTAMP," +
                "    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
                "    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
                "    CONSTRAINT fk_playlists_user FOREIGN KEY (user_id) REFERENCES \"" + schemaName + "\".users (id) ON DELETE CASCADE" +
                ")"
            );

            statement.execute(
                "CREATE TABLE IF NOT EXISTS \"" + schemaName + "\".playlist_items (" +
                "    id UUID PRIMARY KEY," +
                "    playlist_id UUID NOT NULL," +
                "    audio_id UUID NOT NULL," +
                "    position INT NOT NULL," +
                "    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
                "    note TEXT," +
                "    CONSTRAINT fk_playlist_items_playlist FOREIGN KEY (playlist_id) REFERENCES \"" + schemaName + "\".playlists (id) ON DELETE CASCADE," +
                "    CONSTRAINT fk_playlist_items_audio FOREIGN KEY (audio_id) REFERENCES \"" + schemaName + "\".audio_files (id) ON DELETE CASCADE," +
                "    CONSTRAINT uq_playlist_items_playlist_position UNIQUE (playlist_id, position)" +
                ")"
            );

            // Favorites
            statement.execute(
                "CREATE TABLE IF NOT EXISTS \"" + schemaName + "\".user_favorite_audio (" +
                "    user_id UUID NOT NULL," +
                "    audio_id UUID NOT NULL," +
                "    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
                "    PRIMARY KEY (user_id, audio_id)," +
                "    CONSTRAINT fk_user_favorite_audio_user FOREIGN KEY (user_id) REFERENCES \"" + schemaName + "\".users (id) ON DELETE CASCADE," +
                "    CONSTRAINT fk_user_favorite_audio_audio FOREIGN KEY (audio_id) REFERENCES \"" + schemaName + "\".audio_files (id) ON DELETE CASCADE" +
                ")"
            );

            statement.execute(
                "CREATE TABLE IF NOT EXISTS \"" + schemaName + "\".user_favorite_speaker (" +
                "    user_id UUID NOT NULL," +
                "    speaker_id UUID NOT NULL," +
                "    notify_on_new_audio BOOLEAN DEFAULT TRUE," +
                "    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
                "    PRIMARY KEY (user_id, speaker_id)," +
                "    CONSTRAINT fk_user_favorite_speaker_user FOREIGN KEY (user_id) REFERENCES \"" + schemaName + "\".users (id) ON DELETE CASCADE," +
                "    CONSTRAINT fk_user_favorite_speaker_speaker FOREIGN KEY (speaker_id) REFERENCES \"" + schemaName + "\".speakers (id) ON DELETE CASCADE" +
                ")"
            );

            // Listening history
            statement.execute(
                "CREATE TABLE IF NOT EXISTS \"" + schemaName + "\".listening_history (" +
                "    id UUID PRIMARY KEY," +
                "    user_id UUID," +
                "    audio_id UUID NOT NULL," +
                "    client_session_id UUID," +
                "    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
                "    ended_at TIMESTAMP," +
                "    seconds_listened BIGINT," +
                "    progress_seconds BIGINT," +
                "    source VARCHAR(50)," +
                "    tenant_id UUID," +
                "    CONSTRAINT fk_listening_history_user FOREIGN KEY (user_id) REFERENCES \"" + schemaName + "\".users (id) ON DELETE SET NULL," +
                "    CONSTRAINT fk_listening_history_audio FOREIGN KEY (audio_id) REFERENCES \"" + schemaName + "\".audio_files (id) ON DELETE CASCADE" +
                ")"
            );

            // Notifications
            statement.execute(
                "CREATE TABLE IF NOT EXISTS \"" + schemaName + "\".notifications (" +
                "    id UUID PRIMARY KEY," +
                "    user_id UUID NOT NULL," +
                "    type VARCHAR(50) NOT NULL," +
                "    title VARCHAR(255)," +
                "    body TEXT," +
                "    payload_json TEXT," +
                "    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
                "    read_at TIMESTAMP," +
                "    tenant_id UUID," +
                "    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES \"" + schemaName + "\".users (id) ON DELETE CASCADE" +
                ")"
            );

            // Recommendation cache
            statement.execute(
                "CREATE TABLE IF NOT EXISTS \"" + schemaName + "\".recommendation_cache (" +
                "    user_id UUID NOT NULL," +
                "    audio_id UUID NOT NULL," +
                "    score DOUBLE PRECISION," +
                "    reason VARCHAR(255)," +
                "    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
                "    PRIMARY KEY (user_id, audio_id)," +
                "    CONSTRAINT fk_recommendation_cache_user FOREIGN KEY (user_id) REFERENCES \"" + schemaName + "\".users (id) ON DELETE CASCADE," +
                "    CONSTRAINT fk_recommendation_cache_audio FOREIGN KEY (audio_id) REFERENCES \"" + schemaName + "\".audio_files (id) ON DELETE CASCADE" +
                ")"
            );

            // ================================================================
            // P0/P1 ADDITIONS
            // ================================================================

            // P0: User Preferences
            statement.execute(
                "CREATE TABLE IF NOT EXISTS \"" + schemaName + "\".user_preferences (" +
                "    user_id UUID PRIMARY KEY," +
                "    preferred_playback_speed DECIMAL(3,2) DEFAULT 1.0," +
                "    auto_play_next BOOLEAN DEFAULT TRUE," +
                "    email_notifications BOOLEAN DEFAULT TRUE," +
                "    push_notifications BOOLEAN DEFAULT TRUE," +
                "    preferred_language VARCHAR(10)," +
                "    preferred_audio_length VARCHAR(20) DEFAULT 'ANY'," +
                "    theme VARCHAR(20) DEFAULT 'SYSTEM'," +
                "    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
                "    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
                "    CONSTRAINT fk_user_preferences_user FOREIGN KEY (user_id) REFERENCES \"" + schemaName + "\".users (id) ON DELETE CASCADE" +
                ")"
            );

            // P0: Playback Queue
            statement.execute(
                "CREATE TABLE IF NOT EXISTS \"" + schemaName + "\".user_playback_queue (" +
                "    id UUID PRIMARY KEY," +
                "    user_id UUID NOT NULL," +
                "    audio_id UUID NOT NULL," +
                "    position INT NOT NULL," +
                "    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
                "    source VARCHAR(50)," +
                "    CONSTRAINT fk_playback_queue_user FOREIGN KEY (user_id) REFERENCES \"" + schemaName + "\".users (id) ON DELETE CASCADE," +
                "    CONSTRAINT fk_playback_queue_audio FOREIGN KEY (audio_id) REFERENCES \"" + schemaName + "\".audio_files (id) ON DELETE CASCADE," +
                "    CONSTRAINT uq_playback_queue_user_position UNIQUE (user_id, position)" +
                ")"
            );

            // P1: Tags
            statement.execute(
                "CREATE TABLE IF NOT EXISTS \"" + schemaName + "\".tags (" +
                "    id UUID PRIMARY KEY," +
                "    name VARCHAR(100) NOT NULL," +
                "    slug VARCHAR(100) NOT NULL," +
                "    description TEXT," +
                "    color VARCHAR(7)," +
                "    usage_count BIGINT DEFAULT 0," +
                "    tenant_id UUID," +
                "    deleted_at TIMESTAMP," +
                "    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
                "    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
                "    CONSTRAINT uq_tags_tenant_slug UNIQUE (tenant_id, slug)" +
                ")"
            );

            statement.execute(
                "CREATE TABLE IF NOT EXISTS \"" + schemaName + "\".audio_tags (" +
                "    audio_id UUID NOT NULL," +
                "    tag_id UUID NOT NULL," +
                "    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
                "    PRIMARY KEY (audio_id, tag_id)," +
                "    CONSTRAINT fk_audio_tags_audio FOREIGN KEY (audio_id) REFERENCES \"" + schemaName + "\".audio_files (id) ON DELETE CASCADE," +
                "    CONSTRAINT fk_audio_tags_tag FOREIGN KEY (tag_id) REFERENCES \"" + schemaName + "\".tags (id) ON DELETE CASCADE" +
                ")"
            );
            
            log.debug("Tables created in schema {}", schemaName);
        } catch (SQLException e) {
            log.error("Failed to create tables in schema {}: {}", schemaName, e.getMessage());
            throw new RuntimeException("Failed to create tables in schema: " + schemaName, e);
        }
    }

    private void runFlywayMigration(String schemaName) {
        Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration/tenants")
                .schemas(schemaName)
                .baselineOnMigrate(true)
                .load()
                .migrate();
    }
}