package com.audiolibrary.repository;

import com.audiolibrary.entity.Audio;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Repository
public interface AudioRepository extends JpaRepository<Audio, UUID>, JpaSpecificationExecutor<Audio> {

    List<Audio> findByDeletedAtIsNull();

    List<Audio> findByStatusAndDeletedAtIsNull(Audio.Status status);

    long countByDeletedAtIsNull();

    long countByStatusAndDeletedAtIsNull(Audio.Status status);

    List<Audio> findByTenantIdAndDeletedAtIsNull(UUID tenantId);

    List<Audio> findByTenantIdAndStatusAndDeletedAtIsNull(UUID tenantId, Audio.Status status);

    Page<Audio> findByStatusAndDeletedAtIsNull(Audio.Status status, Pageable pageable);

    Optional<Audio> findByFileHashAndDeletedAtIsNull(String fileHash);

    @Query("SELECT a.fileHash FROM Audio a WHERE a.fileHash IN :hashes AND a.deletedAt IS NULL")
    Set<String> findExistingHashes(@Param("hashes") Collection<String> hashes);

    @Query("""
    SELECT DISTINCT a
    FROM Audio a
    JOIN a.audioSpeakers asp
    WHERE asp.speaker.id = :speakerId
    AND a.deletedAt IS NULL
""")
    List<Audio> findAllBySpeakerId(
            @Param("speakerId") UUID speakerId
    );
}

    List<Audio> findBySeriesIdAndDeletedAtIsNullOrderBySeriesOrderAsc(UUID seriesId);
}