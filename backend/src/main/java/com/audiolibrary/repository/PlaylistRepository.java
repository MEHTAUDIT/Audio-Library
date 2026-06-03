package com.audiolibrary.repository;

import com.audiolibrary.entity.Playlist;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PlaylistRepository extends JpaRepository<Playlist, UUID> {

    /**
     * Find all active playlists for a user.
     */
    @Query("SELECT p FROM Playlist p WHERE p.user.id = :userId AND p.deletedAt IS NULL ORDER BY p.updatedAt DESC")
    List<Playlist> findAllActiveByUserId(@Param("userId") UUID userId);

    /**
     * Find all active playlists for a user with pagination.
     */
    @Query("SELECT p FROM Playlist p WHERE p.user.id = :userId AND p.deletedAt IS NULL")
    Page<Playlist> findAllActiveByUserId(@Param("userId") UUID userId, Pageable pageable);

    /**
     * Find active playlist by ID.
     */
    @Query("SELECT p FROM Playlist p WHERE p.id = :id AND p.deletedAt IS NULL")
    Optional<Playlist> findActiveById(@Param("id") UUID id);

    Optional<Playlist> findByShareTokenAndDeletedAtIsNull(String shareToken);

    /**
     * Find public playlists for discovery.
     */
    @Query("SELECT p FROM Playlist p WHERE p.tenantId = :tenantId AND p.visibility = 'PUBLIC' AND p.deletedAt IS NULL")
    Page<Playlist> findPublicPlaylists(@Param("tenantId") UUID tenantId, Pageable pageable);

    /**
     * Search playlists by name.
     */
    @Query("SELECT p FROM Playlist p WHERE p.user.id = :userId AND p.deletedAt IS NULL " +
           "AND LOWER(p.name) LIKE LOWER(CONCAT('%', :query, '%'))")
    List<Playlist> searchByName(@Param("userId") UUID userId, @Param("query") String query);

    /**
     * Count user's active playlists.
     */
    @Query("SELECT COUNT(p) FROM Playlist p WHERE p.user.id = :userId AND p.deletedAt IS NULL")
    long countActiveByUserId(@Param("userId") UUID userId);
}





