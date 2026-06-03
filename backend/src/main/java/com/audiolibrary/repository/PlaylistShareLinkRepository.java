package com.audiolibrary.repository;

import com.audiolibrary.entity.PlaylistShareLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface PlaylistShareLinkRepository extends JpaRepository<PlaylistShareLink, UUID> {
    Optional<PlaylistShareLink> findByTokenAndActiveTrue(String token);
    Optional<PlaylistShareLink> findByPlaylistIdAndActiveTrue(UUID playlistId);
}
