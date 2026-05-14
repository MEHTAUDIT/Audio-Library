package com.audiolibrary.repository;

import com.audiolibrary.entity.AudioMetadata;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AudioMetadataRepository extends JpaRepository<AudioMetadata, UUID> {

    /**
     * Find all metadata for an audio file.
     */
    List<AudioMetadata> findAllByAudioId(UUID audioId);

    /**
     * Find specific metadata by key.
     */
    Optional<AudioMetadata> findByAudioIdAndMetaKey(UUID audioId, String metaKey);

    /**
     * Delete all metadata for an audio.
     */
    void deleteAllByAudioId(UUID audioId);

    /**
     * Delete specific metadata key.
     */
    void deleteByAudioIdAndMetaKey(UUID audioId, String metaKey);

    /**
     * Check if metadata key exists for audio.
     */
    boolean existsByAudioIdAndMetaKey(UUID audioId, String metaKey);

    /**
     * Find all audio IDs with a specific metadata key/value.
     */
    @Query("SELECT m.audio.id FROM AudioMetadata m WHERE m.metaKey = :key AND m.metaValue = :value")
    List<UUID> findAudioIdsByMetaKeyAndValue(@Param("key") String key, @Param("value") String value);
}





