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

    @Query("SELECT s FROM Speaker s WHERE s.tenantId = :tenantId AND s.deletedAt IS NULL")
    Page<Speaker> findAllActiveByTenantId(@Param("tenantId") UUID tenantId, Pageable pageable);

    @Query("SELECT s FROM Speaker s WHERE s.tenantId = :tenantId AND s.deletedAt IS NULL")
    List<Speaker> findAllActiveByTenantId(@Param("tenantId") UUID tenantId);

    @Query("SELECT s FROM Speaker s WHERE s.id = :id AND s.deletedAt IS NULL")
    Optional<Speaker> findActiveById(@Param("id") UUID id);

    @Query("SELECT s FROM Speaker s WHERE s.tenantId = :tenantId AND s.deletedAt IS NULL " +
           "AND LOWER(s.name) LIKE LOWER(CONCAT('%', :query, '%'))")
    Page<Speaker> searchByName(@Param("tenantId") UUID tenantId, @Param("query") String query, Pageable pageable);

    boolean existsByTenantIdAndNameIgnoreCaseAndDeletedAtIsNull(UUID tenantId, String name);

    Optional<Speaker> findByTenantIdAndNameIgnoreCaseAndDeletedAtIsNull(UUID tenantId, String name);
}