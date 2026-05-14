package com.audiolibrary.controller;

import com.audiolibrary.dto.BulkImportDtos.*;
import com.audiolibrary.entity.Tenant;
import com.audiolibrary.repository.TenantRepository;
import com.audiolibrary.service.BulkImportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/bulk-import")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Bulk Import", description = "Bulk import audio files from folder structures")
@SecurityRequirement(name = "bearerAuth")
public class BulkImportController {

    private final BulkImportService bulkImportService;
    private final TenantRepository tenantRepository;

    @Operation(summary = "Scan a server path", description = "Scan a folder on the server to detect structure and suggest mapping. Requires ADMIN role.")
    @PostMapping("/scan")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<ScanResponse> scanPath(
            @RequestBody ScanRequest request,
            @RequestHeader(value = "X-Tenant-ID", required = false) String tenantSubdomain) {
        
        log.info("Scanning path: {}", request.getSourcePath());
        
        try {
            ScanResponse response = bulkImportService.scanDirectory(request.getSourcePath());
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            log.error("Invalid path: {}", e.getMessage());
            return ResponseEntity.badRequest().build();
        } catch (IOException e) {
            log.error("Error scanning path: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @Operation(summary = "Preview import with mapping", description = "Apply a mapping configuration and return preview of all files. Requires ADMIN role.")
    @PostMapping("/preview")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<List<MappedAudioFile>> previewImport(
            @RequestBody ExecuteRequest request) {
        
        log.info("Previewing import for path: {} with {} levels", 
                request.getSourcePath(), 
                request.getMapping().getLevels().size());
        
        try {
            List<MappedAudioFile> mapped = bulkImportService.applyMappingToDirectory(
                    request.getSourcePath(),
                    request.getMapping()
            );
            return ResponseEntity.ok(mapped);
        } catch (IOException e) {
            log.error("Error previewing import: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @Operation(summary = "Import a single file", description = "Import a single file from a server path. Used for sequential imports. Requires ADMIN role.")
    @PostMapping("/upload-single")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<Void> uploadSingleFile(
            @RequestBody SingleFileImportRequest request,
            @RequestHeader(value = "X-Tenant-ID", required = false) String tenantSubdomain) {
        
        // Resolve tenant
        String subdomain = tenantSubdomain != null ? tenantSubdomain : "demo";
        Tenant tenant = tenantRepository.findBySubdomain(subdomain)
                .orElseThrow(() -> new RuntimeException("Tenant not found: " + subdomain));
        
        log.info("Importing single file: {} for tenant: {}", 
                request.getFile().getFilename(), subdomain);
        
        try {
            bulkImportService.importSingleFile(
                    request.getSourcePath(),
                    request.getFile(),
                    tenant.getId()
            );
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            log.error("Invalid file path: {}", e.getMessage());
            return ResponseEntity.badRequest().build();
        } catch (IOException e) {
            log.error("Error importing file: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @Operation(summary = "Execute bulk import", description = "Import all files from a server path with the given mapping. Requires ADMIN role.")
    @PostMapping("/execute")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<JobStatus> executeImport(
            @RequestBody ExecuteRequest request,
            @RequestHeader(value = "X-Tenant-ID", required = false) String tenantSubdomain) {
        
        // Resolve tenant
        String subdomain = tenantSubdomain != null ? tenantSubdomain : "demo";
        Tenant tenant = tenantRepository.findBySubdomain(subdomain)
                .orElseThrow(() -> new RuntimeException("Tenant not found: " + subdomain));
        
        log.info("Executing bulk import for path: {} with {} files for tenant: {}", 
                request.getSourcePath(), 
                request.getFiles().size(),
                subdomain);
        
        // Process synchronously for now (could be made async with job tracking)
        List<ImportError> errors = new ArrayList<>();
        int successCount = 0;
        
        for (MappedAudioFile file : request.getFiles()) {
            try {
                bulkImportService.importSingleFile(
                        request.getSourcePath(),
                        file,
                        tenant.getId()
                );
                successCount++;
            } catch (Exception e) {
                log.error("Failed to import file: {}", file.getFilename(), e);
                errors.add(ImportError.builder()
                        .file(file.getFilename())
                        .error(e.getMessage())
                        .build());
            }
        }
        
        JobStatus status = JobStatus.builder()
                .jobId(UUID.randomUUID().toString())
                .status("completed")
                .totalFiles(request.getFiles().size())
                .processedFiles(request.getFiles().size())
                .successCount(successCount)
                .errorCount(errors.size())
                .errors(errors)
                .build();
        
        log.info("Bulk import completed: {} success, {} errors", successCount, errors.size());
        
        return ResponseEntity.ok(status);
    }

    @Operation(summary = "Get mapping presets", description = "Get available preset mapping configurations.")
    @GetMapping("/presets")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<List<MappingPreset>> getPresets() {
        List<MappingPreset> presets = List.of(
                MappingPreset.builder()
                        .id("speaker-topic")
                        .name("Speaker → Topic")
                        .description("First level is speaker, second is topic")
                        .levels(List.of(
                                PresetLevel.builder()
                                        .depth(0)
                                        .mapping(LevelMapping.builder().type("map_to_field").field("speaker").build())
                                        .build(),
                                PresetLevel.builder()
                                        .depth(1)
                                        .mapping(LevelMapping.builder().type("map_to_field").field("topic").build())
                                        .build()
                        ))
                        .build(),
                MappingPreset.builder()
                        .id("topic-speaker")
                        .name("Topic → Speaker")
                        .description("First level is topic, second is speaker")
                        .levels(List.of(
                                PresetLevel.builder()
                                        .depth(0)
                                        .mapping(LevelMapping.builder().type("map_to_field").field("topic").build())
                                        .build(),
                                PresetLevel.builder()
                                        .depth(1)
                                        .mapping(LevelMapping.builder().type("map_to_field").field("speaker").build())
                                        .build()
                        ))
                        .build(),
                MappingPreset.builder()
                        .id("skip-speaker-topic")
                        .name("Skip → Speaker → Topic")
                        .description("Ignore first level, then speaker and topic")
                        .levels(List.of(
                                PresetLevel.builder()
                                        .depth(0)
                                        .mapping(LevelMapping.builder().type("skip").build())
                                        .build(),
                                PresetLevel.builder()
                                        .depth(1)
                                        .mapping(LevelMapping.builder().type("map_to_field").field("speaker").build())
                                        .build(),
                                PresetLevel.builder()
                                        .depth(2)
                                        .mapping(LevelMapping.builder().type("map_to_field").field("topic").build())
                                        .build()
                        ))
                        .build()
        );
        
        return ResponseEntity.ok(presets);
    }
}

