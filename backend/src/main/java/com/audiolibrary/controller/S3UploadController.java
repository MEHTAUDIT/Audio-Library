package com.audiolibrary.controller;

import com.audiolibrary.dto.S3Dtos.*;
import com.audiolibrary.entity.Tenant;
import com.audiolibrary.repository.TenantRepository;
import com.audiolibrary.service.AudioService;
import com.audiolibrary.service.S3StorageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;

/**
 * Controller for S3 direct upload operations.
 * Provides pre-signed URLs for clients to upload directly to S3.
 * Only active when app.s3.enabled=true.
 */
@RestController
@RequestMapping("/api/v1/s3")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "S3 Upload", description = "Direct S3 upload via pre-signed URLs")
@SecurityRequirement(name = "bearerAuth")
@ConditionalOnProperty(name = "app.s3.enabled", havingValue = "true")
public class S3UploadController {

    private final S3StorageService s3StorageService;
    private final AudioService audioService;
    private final TenantRepository tenantRepository;

    @Operation(
            summary = "Get pre-signed upload URL",
            description = "Generate a pre-signed URL for uploading a file directly to S3. " +
                    "The client should PUT the file to this URL with the specified headers."
    )
    @PostMapping("/upload-url")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<PresignedUploadResponse> getUploadUrl(
            @RequestBody UploadUrlRequest request,
            @RequestHeader(value = "X-Tenant-ID", required = false) String tenantSubdomain) {
        
        Tenant tenant = resolveTenant(tenantSubdomain);
        log.info("Generating upload URL for file: {} (tenant: {})", request.getFilename(), tenant.getSubdomain());
        
        PresignedUploadResponse response = s3StorageService.generateUploadUrl(
                tenant.getId(),
                request.getFilename(),
                request.getContentType() != null ? request.getContentType() : "audio/mpeg"
        );
        
        return ResponseEntity.ok(response);
    }

    @Operation(
            summary = "Get batch pre-signed upload URLs",
            description = "Generate multiple pre-signed URLs for bulk upload. " +
                    "Each file gets its own URL for parallel uploads."
    )
    @PostMapping("/upload-urls/batch")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<BatchUploadUrlResponse> getBatchUploadUrls(
            @RequestBody BatchUploadUrlRequest request,
            @RequestHeader(value = "X-Tenant-ID", required = false) String tenantSubdomain) {
        
        Tenant tenant = resolveTenant(tenantSubdomain);
        log.info("Generating {} upload URLs for tenant: {}", request.getFiles().size(), tenant.getSubdomain());
        
        List<PresignedUploadResponse> uploads = s3StorageService.generateBatchUploadUrls(
                tenant.getId(),
                request.getFiles()
        );
        BatchUploadUrlResponse response = BatchUploadUrlResponse.builder()
                .uploads(uploads)
                .totalFiles(uploads.size())
                .build();
        
        return ResponseEntity.ok(response);
    }

    @Operation(
            summary = "Confirm upload and create audio record",
            description = "After uploading to S3, call this to confirm and create the audio record in the database."
    )
    @PostMapping("/confirm-upload")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<Void> confirmUpload(
            @RequestBody ConfirmUploadRequest request,
            @RequestHeader(value = "X-Tenant-ID", required = false) String tenantSubdomain) {
        
        Tenant tenant = resolveTenant(tenantSubdomain);
        log.info("Confirming upload for S3 key: {} (tenant: {})", request.getS3Key(), tenant.getSubdomain());
        
        // Verify the file exists in S3
        if (!s3StorageService.objectExists(request.getS3Key())) {
            log.error("File not found in S3: {}", request.getS3Key());
            return ResponseEntity.badRequest().build();
        }
        
        // Get file metadata from S3
        S3ObjectMetadata metadata = s3StorageService.getObjectMetadata(request.getS3Key());
        
        // Create audio record
        String title = request.getTitle() != null ? request.getTitle() : 
                request.getFilename().replaceFirst("[.][^.]+$", "").replace("[-_]", " ");
        
        audioService.createDraftWithFile(
                title,
                request.getDescription(),
                request.getSpeaker(),
                request.getTopic(),
                request.getS3Key(),  // Storage key is now the S3 key
                request.getFilename(),
                metadata.getSize(),
                metadata.getContentType(),
                0L,  // Duration will be calculated separately if needed
                tenant.getId(),
                null
        );
        
        log.info("Audio record created for S3 key: {}", request.getS3Key());
        return ResponseEntity.ok().build();
    }

    @Operation(
            summary = "Confirm batch uploads",
            description = "Confirm multiple uploads at once after bulk S3 upload."
    )
    @PostMapping("/confirm-uploads/batch")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<BatchConfirmResult> confirmBatchUploads(
            @RequestBody BatchConfirmUploadRequest request,
            @RequestHeader(value = "X-Tenant-ID", required = false) String tenantSubdomain) {
        
        Tenant tenant = resolveTenant(tenantSubdomain);
        log.info("Confirming {} uploads for tenant: {}", request.getFiles().size(), tenant.getSubdomain());
        
        List<String> succeeded = new ArrayList<>();
        List<ConfirmError> failed = new ArrayList<>();
        
        for (ConfirmUploadRequest file : request.getFiles()) {
            try {
                // Verify file exists
                if (!s3StorageService.objectExists(file.getS3Key())) {
                    failed.add(new ConfirmError(file.getS3Key(), file.getFilename(), "File not found in S3"));
                    continue;
                }
                
                // Get metadata
                S3ObjectMetadata metadata = s3StorageService.getObjectMetadata(file.getS3Key());
                
                // Create audio record
                String title = file.getTitle() != null ? file.getTitle() : 
                        file.getFilename().replaceFirst("[.][^.]+$", "").replace("[-_]", " ");
                
                audioService.createDraftWithFile(
                        title,
                        file.getDescription(),
                        file.getSpeaker(),
                        file.getTopic(),
                        file.getS3Key(),
                        file.getFilename(),
                        metadata.getSize(),
                        metadata.getContentType(),
                        0L,
                        tenant.getId(),
                        null
                );
                
                succeeded.add(file.getS3Key());
            } catch (Exception e) {
                log.error("Failed to confirm upload for {}: {}", file.getS3Key(), e.getMessage());
                failed.add(new ConfirmError(file.getS3Key(), file.getFilename(), e.getMessage()));
            }
        }
        
        BatchConfirmResult result = BatchConfirmResult.builder()
                .totalProcessed(request.getFiles().size())
                .successCount(succeeded.size())
                .failureCount(failed.size())
                .succeeded(succeeded)
                .failed(failed)
                .build();
        
        log.info("Batch confirm complete: {} succeeded, {} failed", succeeded.size(), failed.size());
        return ResponseEntity.ok(result);
    }

    @Operation(
            summary = "List uploaded files in S3",
            description = "List all files uploaded to the tenant's S3 folder."
    )
    @GetMapping("/files")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<ListObjectsResponse> listFiles(
            @RequestParam(required = false) String subPath,
            @RequestHeader(value = "X-Tenant-ID", required = false) String tenantSubdomain) {
        
        Tenant tenant = resolveTenant(tenantSubdomain);
        
        List<S3ObjectInfo> objects = s3StorageService.listTenantObjects(tenant.getId(), subPath);
        
        ListObjectsResponse response = ListObjectsResponse.builder()
                .objects(objects)
                .totalCount(objects.size())
                .prefix(subPath)
                .build();
        
        return ResponseEntity.ok(response);
    }

    // ==================== STAGING ENDPOINTS ====================

    @Operation(
            summary = "Get staging upload URLs",
            description = "Generate pre-signed URLs for uploading to staging area. " +
                    "Files in staging are not yet processed - use /staging/process to organize and confirm."
    )
    @PostMapping("/staging/upload-urls")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<BatchUploadUrlResponse> getStagingUploadUrls(
            @RequestBody BatchUploadUrlRequest request,
            @RequestHeader(value = "X-Tenant-ID", required = false) String tenantSubdomain) {
        
        Tenant tenant = resolveTenant(tenantSubdomain);
        log.info("Generating {} staging upload URLs for tenant: {}", request.getFiles().size(), tenant.getSubdomain());
        
        List<PresignedUploadResponse> uploads = s3StorageService.generateBatchStagingUploadUrls(
                tenant.getId(),
                request.getFiles()
        );
        
        BatchUploadUrlResponse response = BatchUploadUrlResponse.builder()
                .uploads(uploads)
                .totalFiles(uploads.size())
                .build();
        
        return ResponseEntity.ok(response);
    }

    @Operation(
            summary = "Notify upload complete",
            description = "Notify backend that file uploads to staging are complete. " +
                    "Returns the list of files ready for processing."
    )
    @PostMapping("/staging/upload-complete")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<StagingStatusResponse> notifyUploadComplete(
            @RequestHeader(value = "X-Tenant-ID", required = false) String tenantSubdomain) {
        
        Tenant tenant = resolveTenant(tenantSubdomain);
        log.info("Upload complete notification for tenant: {}", tenant.getSubdomain());
        
        // List all files in staging
        List<S3ObjectInfo> stagingFiles = s3StorageService.listStagingFiles(tenant.getId());
        
        StagingStatusResponse response = StagingStatusResponse.builder()
                .tenantId(tenant.getId().toString())
                .filesInStaging(stagingFiles.size())
                .files(stagingFiles)
                .status("ready_for_processing")
                .build();
        
        return ResponseEntity.ok(response);
    }

    @Operation(
            summary = "List files in staging",
            description = "Get all files currently in the staging area waiting to be processed."
    )
    @GetMapping("/staging/files")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<ListObjectsResponse> listStagingFiles(
            @RequestHeader(value = "X-Tenant-ID", required = false) String tenantSubdomain) {
        
        Tenant tenant = resolveTenant(tenantSubdomain);
        
        List<S3ObjectInfo> files = s3StorageService.listStagingFiles(tenant.getId());
        
        ListObjectsResponse response = ListObjectsResponse.builder()
                .objects(files)
                .totalCount(files.size())
                .prefix("staging")
                .build();
        
        return ResponseEntity.ok(response);
    }

    @Operation(
            summary = "Process staged files",
            description = "Move files from staging to permanent storage and create audio records with metadata."
    )
    @PostMapping("/staging/process")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<BatchConfirmResult> processStagedFiles(
            @RequestBody ProcessStagingRequest request,
            @RequestHeader(value = "X-Tenant-ID", required = false) String tenantSubdomain) {
        
        Tenant tenant = resolveTenant(tenantSubdomain);
        log.info("Processing {} staged files for tenant: {}", request.getFiles().size(), tenant.getSubdomain());
        
        List<String> succeeded = new ArrayList<>();
        List<ConfirmError> failed = new ArrayList<>();
        
        for (StagingFileMetadata file : request.getFiles()) {
            try {
                // Verify file exists in staging
                if (!s3StorageService.objectExists(file.getStagingKey())) {
                    failed.add(new ConfirmError(file.getStagingKey(), file.getFilename(), "File not found in staging"));
                    continue;
                }
                
                // Move from staging to permanent storage
                String permanentKey = s3StorageService.moveFromStagingToPermanent(file.getStagingKey(), tenant.getId());
                
                // Get metadata
                S3ObjectMetadata metadata = s3StorageService.getObjectMetadata(permanentKey);
                
                // Create audio record
                String title = file.getTitle() != null ? file.getTitle() : 
                        file.getFilename().replaceFirst("[.][^.]+$", "").replace("[-_]", " ");
                
                audioService.createDraftWithFile(
                        title,
                        file.getDescription(),
                        file.getSpeaker(),
                        file.getTopic(),
                        permanentKey,
                        file.getFilename(),
                        metadata.getSize(),
                        metadata.getContentType(),
                        0L,
                        tenant.getId(),
                        null
                );
                
                succeeded.add(permanentKey);
            } catch (Exception e) {
                log.error("Failed to process staged file {}: {}", file.getStagingKey(), e.getMessage());
                failed.add(new ConfirmError(file.getStagingKey(), file.getFilename(), e.getMessage()));
            }
        }
        
        BatchConfirmResult result = BatchConfirmResult.builder()
                .totalProcessed(request.getFiles().size())
                .successCount(succeeded.size())
                .failureCount(failed.size())
                .succeeded(succeeded)
                .failed(failed)
                .build();
        
        log.info("Staging processing complete: {} succeeded, {} failed", succeeded.size(), failed.size());
        return ResponseEntity.ok(result);
    }

    @Operation(
            summary = "Clear staging area",
            description = "Delete all files in staging (e.g., if upload is cancelled)."
    )
    @DeleteMapping("/staging/clear")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<ClearStagingResponse> clearStaging(
            @RequestHeader(value = "X-Tenant-ID", required = false) String tenantSubdomain) {
        
        Tenant tenant = resolveTenant(tenantSubdomain);
        log.info("Clearing staging area for tenant: {}", tenant.getSubdomain());
        
        int deletedCount = s3StorageService.clearStagingFiles(tenant.getId());
        
        return ResponseEntity.ok(ClearStagingResponse.builder()
                .deletedCount(deletedCount)
                .message("Staging area cleared")
                .build());
    }

    private Tenant resolveTenant(String tenantSubdomain) {
        String subdomain = tenantSubdomain != null ? tenantSubdomain : "demo";
        return tenantRepository.findBySubdomain(subdomain)
                .orElseThrow(() -> new RuntimeException("Tenant not found: " + subdomain));
    }

    // Inner classes for batch confirm response
    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class BatchConfirmResult {
        private int totalProcessed;
        private int successCount;
        private int failureCount;
        private List<String> succeeded;
        private List<ConfirmError> failed;
    }

    @lombok.Data
    @lombok.AllArgsConstructor
    public static class ConfirmError {
        private String s3Key;
        private String filename;
        private String error;
    }
}

