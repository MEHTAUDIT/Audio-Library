package com.audiolibrary.repository;

import com.audiolibrary.entity.PlaylistItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PlaylistItemRepository extends JpaRepository<PlaylistItem, UUID> {

    /**
     * Find all items in a playlist ordered by position.
     */
    @Query("SELECT pi FROM PlaylistItem pi JOIN FETCH pi.audio WHERE pi.playlist.id = :playlistId ORDER BY pi.position")
    List<PlaylistItem> findAllByPlaylistIdOrderByPosition(@Param("playlistId") UUID playlistId);

    @Query("""
           SELECT pi
           FROM PlaylistItem pi
           JOIN FETCH pi.audio a
           WHERE pi.playlist.id = :playlistId
           AND a.status = 'PUBLISHED'
           AND a.deletedAt IS NULL
           ORDER BY pi.position
           """)
    List<PlaylistItem> findPublishedByPlaylistIdOrderByPosition(@Param("playlistId") UUID playlistId);

    /**
     * Find item by playlist and audio.
     */
    Optional<PlaylistItem> findByPlaylistIdAndAudioId(UUID playlistId, UUID audioId);

    /**
     * Get max position in playlist.
     */
    @Query("SELECT COALESCE(MAX(pi.position), 0) FROM PlaylistItem pi WHERE pi.playlist.id = :playlistId")
    int findMaxPositionByPlaylistId(@Param("playlistId") UUID playlistId);

    /**
     * Count items in playlist.
     */
    long countByPlaylistId(UUID playlistId);

    /**
     * Check if audio exists in playlist.
     */
    boolean existsByPlaylistIdAndAudioId(UUID playlistId, UUID audioId);

    /**
     * Delete all items in a playlist.
     */
    void deleteAllByPlaylistId(UUID playlistId);

    /**
     * Shift positions down (for insertion).
     */
    @Modifying
    @Query("UPDATE PlaylistItem pi SET pi.position = pi.position + 1 " +
           "WHERE pi.playlist.id = :playlistId AND pi.position >= :fromPosition")
    void shiftPositionsDown(@Param("playlistId") UUID playlistId, @Param("fromPosition") int fromPosition);

    /**
     * Shift positions up (for deletion).
     */
    @Modifying
    @Query("UPDATE PlaylistItem pi SET pi.position = pi.position - 1 " +
           "WHERE pi.playlist.id = :playlistId AND pi.position > :fromPosition")
    void shiftPositionsUp(@Param("playlistId") UUID playlistId, @Param("fromPosition") int fromPosition);
}





