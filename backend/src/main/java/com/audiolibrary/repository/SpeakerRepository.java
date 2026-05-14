package com.audiolibrary.repository;

import com.audiolibrary.entity.Speaker;
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
public interface SpeakerRepository extends JpaRepository<Speaker, UUID> {

    /**
     * Find all active (non-deleted) speakers for a tenant.
     */
    @Query("SELECT s FROM Speaker s WHERE s.tenantId = :tenantId AND s.deletedAt IS NULL")
    Page<Speaker> findAllActiveByTenantId(@Param("tenantId") UUID tenantId, Pageable pageable);

    /**
     * Find all active speakers by tenant.
     */
    @Query("SELECT s FROM Speaker s WHERE s.tenantId = :tenantId AND s.deletedAt IS NULL")
    List<Speaker> findAllActiveByTenantId(@Param("tenantId") UUID tenantId);

    /**
     * Find speaker by ID only if not deleted.
     */
    @Query("SELECT s FROM Speaker s WHERE s.id = :id AND s.deletedAt IS NULL")
    Optional<Speaker> findActiveById(@Param("id") UUID id);

    /**
     * Search speakers by name (case-insensitive).
     */
    @Query("SELECT s FROM Speaker s WHERE s.tenantId = :tenantId AND s.deletedAt IS NULL " +
           "AND LOWER(s.name) LIKE LOWER(CONCAT('%', :query, '%'))")
    Page<Speaker> searchByName(@Param("tenantId") UUID tenantId, @Param("query") String query, Pageable pageable);

    /**
     * Check if speaker name exists for tenant.
     */
    boolean existsByTenantIdAndNameIgnoreCaseAndDeletedAtIsNull(UUID tenantId, String name);
}





