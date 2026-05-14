package com.audiolibrary.repository;

import com.audiolibrary.entity.AnalyticsEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface AnalyticsEventRepository extends JpaRepository<AnalyticsEvent, UUID> {

    /**
     * Find events for a tenant in a time range.
     */
    @Query("SELECT e FROM AnalyticsEvent e WHERE e.tenantId = :tenantId " +
           "AND e.occurredAt BETWEEN :start AND :end ORDER BY e.occurredAt DESC")
    Page<AnalyticsEvent> findByTenantIdAndDateRange(
            @Param("tenantId") UUID tenantId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end,
            Pageable pageable);

    /**
     * Count events by type for a tenant.
     */
    @Query("SELECT e.eventType, COUNT(e) FROM AnalyticsEvent e " +
           "WHERE e.tenantId = :tenantId AND e.occurredAt BETWEEN :start AND :end " +
           "GROUP BY e.eventType")
    List<Object[]> countByEventType(
            @Param("tenantId") UUID tenantId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end);

    /**
     * Count unique users for a tenant in time range.
     */
    @Query("SELECT COUNT(DISTINCT e.userId) FROM AnalyticsEvent e " +
           "WHERE e.tenantId = :tenantId AND e.occurredAt BETWEEN :start AND :end")
    long countUniqueUsers(
            @Param("tenantId") UUID tenantId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end);

    /**
     * Find top audio by play events.
     */
    @Query("SELECT e.audioId, COUNT(e) as plays FROM AnalyticsEvent e " +
           "WHERE e.tenantId = :tenantId AND e.eventType = 'AUDIO_PLAY' " +
           "AND e.occurredAt BETWEEN :start AND :end " +
           "GROUP BY e.audioId ORDER BY plays DESC")
    List<Object[]> findTopAudioByPlays(
            @Param("tenantId") UUID tenantId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end,
            Pageable pageable);

    /**
     * Count total events for a tenant.
     */
    long countByTenantId(UUID tenantId);
}





