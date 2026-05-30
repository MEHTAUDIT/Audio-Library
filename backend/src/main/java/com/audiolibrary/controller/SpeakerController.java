package com.audiolibrary.controller;

import com.audiolibrary.dto.AudioResponse;
import com.audiolibrary.dto.SpeakerUpsertRequest;
import com.audiolibrary.entity.Tenant;
import com.audiolibrary.repository.TenantRepository;
import com.audiolibrary.service.SpeakerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
@RequestMapping("api/v1/speaker")
@Tag(name = "Speaker", description = "Speaker profile management")
@SecurityRequirement(name = "bearerAuth")
public class SpeakerController {
    private final SpeakerService speakerService;
    private final TenantRepository tenantRepository;

    @Operation(summary = "Get speaker profile", description = "Fetch a speaker profile and associated audio items.")
    @GetMapping("/{speaker_Id}")
    public ResponseEntity<AudioResponse.SpeakerProfileResponse> getSpeakerProfile(@PathVariable UUID speaker_Id) {
        return speakerService.getSpeaker(speaker_Id);
    }

    @Operation(summary = "Create speaker", description = "Create a new speaker for the current tenant.")
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<AudioResponse.SpeakerProfileResponse> createSpeaker(
            @RequestBody SpeakerUpsertRequest request,
            @RequestHeader(value = "X-Tenant-ID", required = false) String tenantSubdomain) {
        Tenant tenant = resolveTenant(tenantSubdomain);
        return ResponseEntity.ok(speakerService.createSpeaker(tenant.getId(), request));
    }

    @Operation(summary = "Update speaker", description = "Update an existing speaker for the current tenant.")
    @PutMapping("/{speakerId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<AudioResponse.SpeakerProfileResponse> updateSpeaker(
            @PathVariable UUID speakerId,
            @RequestBody SpeakerUpsertRequest request,
            @RequestHeader(value = "X-Tenant-ID", required = false) String tenantSubdomain) {
        Tenant tenant = resolveTenant(tenantSubdomain);
        return ResponseEntity.ok(speakerService.updateSpeaker(tenant.getId(), speakerId, request));
    }

    private Tenant resolveTenant(String tenantSubdomain) {
        String subdomain = tenantSubdomain != null ? tenantSubdomain : "demo";
        return tenantRepository.findBySubdomain(subdomain)
                .orElseThrow(() -> new RuntimeException("Tenant not found: " + subdomain));
    }
}
