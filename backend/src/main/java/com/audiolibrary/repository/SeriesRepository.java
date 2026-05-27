package com.audiolibrary.repository;

import com.audiolibrary.entity.Series;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SeriesRepository extends JpaRepository<Series, UUID> {

    List<Series> findByTenantIdAndDeletedAtIsNullOrderByNameAsc(UUID tenantId);

    Optional<Series> findByNameAndTenantIdAndDeletedAtIsNull(String name, UUID tenantId);

    Optional<Series> findByIdAndDeletedAtIsNull(UUID id);

    boolean existsByNameAndTenantIdAndDeletedAtIsNull(String name, UUID tenantId);

    @Query("SELECT s FROM Series s WHERE s.deletedAt IS NULL AND s.tenantId = :tenantId " +
            "AND EXISTS (SELECT a FROM Audio a WHERE a.seriesId = s.id AND a.status = 'PUBLISHED' AND a.deletedAt IS NULL)")
    List<Series> findPublishedSeries(@Param("tenantId") UUID tenantId);
}