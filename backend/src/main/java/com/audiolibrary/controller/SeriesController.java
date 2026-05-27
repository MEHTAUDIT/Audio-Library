package com.audiolibrary.controller;

import com.audiolibrary.dto.SeriesRequest;
import com.audiolibrary.dto.SeriesResponse;
import com.audiolibrary.entity.Tenant;
import com.audiolibrary.repository.TenantRepository;
import com.audiolibrary.service.SeriesService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/series")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Series", description = "Series/collection management for grouping related content")
@SecurityRequirement(name = "bearerAuth")
public class SeriesController {

    private final SeriesService seriesService;
    private final TenantRepository tenantRepository;

    @Operation(summary = "Get published series", description = "List series that have published content. Public endpoint.")
    @GetMapping("/published")
    @PreAuthorize("permitAll()")
    public ResponseEntity<List<SeriesResponse>> getPublishedSeries(
            @RequestHeader(value = "X-Tenant-ID", required = false) String tenantSubdomain) {
        Tenant tenant = resolveTenant(tenantSubdomain);
        return ResponseEntity.ok(seriesService.getPublishedSeries(tenant.getId()));
    }

    @Operation(summary = "Get published series detail", description = "Get a series with its published audio items. Public endpoint.")
    @GetMapping("/{id}/published")
    @PreAuthorize("permitAll()")
    public ResponseEntity<SeriesResponse> getPublishedSeriesById(@PathVariable UUID id) {
        return ResponseEntity.ok(seriesService.getPublishedSeriesById(id));
    }

    @Operation(summary = "List all series", description = "Get all series for the tenant. Requires ADMIN role.")
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<List<SeriesResponse>> getAllSeries(
            @RequestHeader(value = "X-Tenant-ID", required = false) String tenantSubdomain) {
        Tenant tenant = resolveTenant(tenantSubdomain);
        return ResponseEntity.ok(seriesService.getAllSeries(tenant.getId()));
    }

    @Operation(summary = "Get series detail", description = "Get series with all audio items (ordered). Requires ADMIN role.")
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<SeriesResponse> getSeriesById(@PathVariable UUID id) {
        return ResponseEntity.ok(seriesService.getSeriesById(id));
    }

    @Operation(summary = "Create series", description = "Create a new series/collection. Requires ADMIN role.")
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<SeriesResponse> createSeries(
            @RequestBody SeriesRequest request,
            @RequestHeader(value = "X-Tenant-ID", required = false) String tenantSubdomain) {
        Tenant tenant = resolveTenant(tenantSubdomain);
        return ResponseEntity.ok(seriesService.createSeries(request, tenant.getId()));
    }

    @Operation(summary = "Update series", description = "Update series metadata. Requires ADMIN role.")
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<SeriesResponse> updateSeries(
            @PathVariable UUID id,
            @RequestBody SeriesRequest request) {
        return ResponseEntity.ok(seriesService.updateSeries(id, request));
    }

    @Operation(summary = "Delete series", description = "Soft delete a series. Audio items are unlinked, not deleted. Requires ADMIN role.")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<Void> deleteSeries(@PathVariable UUID id) {
        seriesService.deleteSeries(id);
        return ResponseEntity.noContent().build();
    }

    // ==================== AUDIO MANAGEMENT ====================

    @Operation(summary = "Add audio to series", description = "Add an audio/video item to a series with optional ordering.")
    @PostMapping("/{seriesId}/audio")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<Void> addAudioToSeries(
            @PathVariable UUID seriesId,
            @RequestBody AddAudioRequest request) {
        seriesService.addAudioToSeries(seriesId, request.getAudioId(), request.getOrder());
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "Remove audio from series", description = "Remove an audio/video item from a series.")
    @DeleteMapping("/{seriesId}/audio/{audioId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<Void> removeAudioFromSeries(
            @PathVariable UUID seriesId,
            @PathVariable UUID audioId) {
        seriesService.removeAudioFromSeries(audioId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Reorder series audio", description = "Set the order of audio items within a series.")
    @PutMapping("/{seriesId}/reorder")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<Void> reorderSeriesAudio(
            @PathVariable UUID seriesId,
            @RequestBody List<UUID> audioIds) {
        seriesService.reorderSeriesAudio(seriesId, audioIds);
        return ResponseEntity.ok().build();
    }

    private Tenant resolveTenant(String tenantSubdomain) {
        String subdomain = tenantSubdomain != null ? tenantSubdomain : "demo";
        return tenantRepository.findBySubdomain(subdomain)
                .orElseThrow(() -> new RuntimeException("Tenant not found: " + subdomain));
    }

    // Inner DTO for add-audio request
    @lombok.Data
    public static class AddAudioRequest {
        private UUID audioId;
        private Integer order; // optional — auto-assigned if null
    }
}