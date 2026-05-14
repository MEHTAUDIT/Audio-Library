package com.audiolibrary.repository;

import com.audiolibrary.entity.AnalyticsDailyAudio;
import com.audiolibrary.entity.AnalyticsDailyAudioId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface AnalyticsDailyAudioRepository extends JpaRepository<AnalyticsDailyAudio, AnalyticsDailyAudioId> {

    /**
     * Find daily stats for a tenant in date range.
     */
    @Query("SELECT a FROM AnalyticsDailyAudio a WHERE a.id.tenantId = :tenantId " +
           "AND a.id.date BETWEEN :start AND :end ORDER BY a.id.date DESC")
    List<AnalyticsDailyAudio> findByTenantIdAndDateBetween(
            @Param("tenantId") UUID tenantId,
            @Param("start") LocalDate start,
            @Param("end") LocalDate end);

    /**
     * Find stats for a specific audio.
     */
    @Query("SELECT a FROM AnalyticsDailyAudio a WHERE a.id.audioId = :audioId " +
           "AND a.id.date BETWEEN :start AND :end ORDER BY a.id.date DESC")
    List<AnalyticsDailyAudio> findByAudioIdAndDateBetween(
            @Param("audioId") UUID audioId,
            @Param("start") LocalDate start,
            @Param("end") LocalDate end);

    /**
     * Get top audio by plays for a date range.
     */
    @Query("SELECT a.id.audioId, SUM(a.plays) as totalPlays FROM AnalyticsDailyAudio a " +
           "WHERE a.id.tenantId = :tenantId AND a.id.date BETWEEN :start AND :end " +
           "GROUP BY a.id.audioId ORDER BY totalPlays DESC")
    List<Object[]> findTopAudioByPlays(
            @Param("tenantId") UUID tenantId,
            @Param("start") LocalDate start,
            @Param("end") LocalDate end);

    /**
     * Get total plays for tenant in date range.
     */
    @Query("SELECT COALESCE(SUM(a.plays), 0) FROM AnalyticsDailyAudio a " +
           "WHERE a.id.tenantId = :tenantId AND a.id.date BETWEEN :start AND :end")
    long getTotalPlaysByTenantAndDateBetween(
            @Param("tenantId") UUID tenantId,
            @Param("start") LocalDate start,
            @Param("end") LocalDate end);

    /**
     * Get total listening time for tenant in date range.
     */
    @Query("SELECT COALESCE(SUM(a.totalSecondsListened), 0) FROM AnalyticsDailyAudio a " +
           "WHERE a.id.tenantId = :tenantId AND a.id.date BETWEEN :start AND :end")
    long getTotalListeningTimeByTenantAndDateBetween(
            @Param("tenantId") UUID tenantId,
            @Param("start") LocalDate start,
            @Param("end") LocalDate end);
}





