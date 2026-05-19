package com.audiolibrary.repository;

import com.audiolibrary.entity.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TagRepository extends JpaRepository<Tag, UUID> {

    @Query("SELECT t FROM Tag t WHERE t.tenantId = :tenantId AND t.deletedAt IS NULL ORDER BY t.name")
    List<Tag> findAllActiveByTenantId(@Param("tenantId") UUID tenantId);

    @Query("SELECT t FROM Tag t WHERE t.tenantId = :tenantId AND t.deletedAt IS NULL")
    Page<Tag> findAllActiveByTenantId(@Param("tenantId") UUID tenantId, Pageable pageable);

    @Query("SELECT t FROM Tag t WHERE t.tenantId = :tenantId AND t.slug = :slug AND t.deletedAt IS NULL")
    Optional<Tag> findByTenantIdAndSlug(@Param("tenantId") UUID tenantId, @Param("slug") String slug);

    @Query("SELECT t FROM Tag t WHERE t.id = :id AND t.deletedAt IS NULL")
    Optional<Tag> findActiveById(@Param("id") UUID id);

    @Query("SELECT t FROM Tag t WHERE t.tenantId = :tenantId AND t.deletedAt IS NULL " +
           "AND LOWER(t.name) LIKE LOWER(CONCAT('%', :query, '%'))")
    List<Tag> searchByName(@Param("tenantId") UUID tenantId, @Param("query") String query);

    @Query("SELECT t FROM Tag t WHERE t.tenantId = :tenantId AND t.deletedAt IS NULL " +
           "ORDER BY t.usageCount DESC")
    List<Tag> findTopByUsage(@Param("tenantId") UUID tenantId, Pageable pageable);

    boolean existsByTenantIdAndSlugAndDeletedAtIsNull(UUID tenantId, String slug);

    @Modifying
    @Query("UPDATE Tag t SET t.usageCount = t.usageCount + 1 WHERE t.id = :tagId")
    void incrementUsageCount(@Param("tagId") UUID tagId);

    @Modifying
    @Query("UPDATE Tag t SET t.usageCount = CASE WHEN t.usageCount > 0 THEN t.usageCount - 1 ELSE 0 END WHERE t.id = :tagId")
    void decrementUsageCount(@Param("tagId") UUID tagId);

    Optional<Tag> findByTenantIdAndNameIgnoreCaseAndDeletedAtIsNull(UUID tenantId, String name);
}