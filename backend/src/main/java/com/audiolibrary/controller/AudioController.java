package com.audiolibrary.controller;

import com.audiolibrary.dto.AudioResponse;
import com.audiolibrary.dto.AudioUpdateRequest;
import com.audiolibrary.entity.Audio;
import com.audiolibrary.entity.Tenant;
import com.audiolibrary.repository.TenantRepository;
import com.audiolibrary.service.AudioService;
import com.audiolibrary.service.BulkImportService;
import com.audiolibrary.service.StorageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;  
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/audio")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Audio", description = "Audio file management endpoints")
@SecurityRequirement(name = "bearerAuth")
public class AudioController {

    private final AudioService audioService;
    private final BulkImportService bulkImportService;
    private final TenantRepository tenantRepository;
    private final StorageService storageService;

    // ==================== PUBLIC ENDPOINTS ====================

    @Operation(summary = "Get published audio", description = "Get all published audio visible to users. This endpoint is public.")
    @GetMapping("/published")
    @PreAuthorize("permitAll()")
    public ResponseEntity<List<AudioResponse>> getPublishedAudio() {
        return ResponseEntity.ok(audioService.getPublishedAudio());
    }
    @Operation(summary = "Filter the audio list", description = "Get the filtered audio list results after applying filters")
    @GetMapping("/search")
    @PreAuthorize("permitAll()")
    public ResponseEntity<List<AudioResponse>> getFilteredAudioResults(@RequestParam(required = false) String speaker_name,
                                                                       @RequestParam(required = false) String tag,
                                                                       @RequestParam(required = false) String genre,
                                                                       @RequestParam(required = false) String audio_substring){
        return ResponseEntity.ok(audioService.getFilteredAudioList(speaker_name, tag, genre, audio_substring));
    }
    @Operation(summary = "Get audio by ID", description = "Get a single audio file by its UUID. Published audio is public, drafts require admin access.")
    @GetMapping("/{id}")
    @PreAuthorize("@audioSecurity.canView(#id, authentication)")
    public ResponseEntity<AudioResponse> getAudioById(@PathVariable UUID id) {
        return ResponseEntity.ok(audioService.getAudioById(id));
    }

    @Operation(summary = "Stream audio file", description = "Stream the audio file for playback. Published audio is public. For S3 storage, redirects to pre-signed URL.")
    @GetMapping("/{id}/stream")
    @PreAuthorize("@audioSecurity.canStream(#id, authentication)")
    public ResponseEntity<?> streamAudio(
            @PathVariable UUID id,
            @RequestHeader(value = "X-Tenant-ID", required = false) String tenantSubdomain) {
        
        log.info("Stream request for audio: {}, tenant header: {}", id, tenantSubdomain);
        
        try {
            Audio audio = audioService.getAudioEntity(id);
            
            log.info("Found audio: {}, storageKey: {}", audio.getTitle(), audio.getStorageKey());
            
            if (audio.getStorageKey() == null) {
                log.warn("Audio {} has no storage key (seeded data without actual file)", id);
                return ResponseEntity.notFound().build();
            }
            
            // For S3 storage, redirect to pre-signed URL
            if (storageService.isS3Storage()) {
                String presignedUrl = storageService.getFileUrl(audio.getStorageKey());
                return ResponseEntity.status(302)
                        .header(HttpHeaders.LOCATION, presignedUrl)
                        .build();
            }
            
            // For local storage, serve the file directly
            Resource resource = storageService.loadFileAsResource(audio.getStorageKey());
            
            String contentType = audio.getMimeType() != null ? audio.getMimeType() : "application/octet-stream";
            String filename = audio.getOriginalFilename() != null ? audio.getOriginalFilename() : "media_file";
            
            log.info("Streaming media: {}, contentType: {}", filename, contentType);
            
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                    .body(resource);
        } catch (Exception e) {
            log.error("Error streaming audio {}: {}", id, e.getMessage(), e);
            return ResponseEntity.notFound().build();
        }
    }

    @Operation(summary = "Download audio file", description = "Download the audio file. Published audio is public. For S3 storage, redirects to pre-signed URL.")
    @GetMapping("/{id}/download")
    @PreAuthorize("@audioSecurity.canDownload(#id, authentication)")
    public ResponseEntity<?> downloadAudio(
            @PathVariable UUID id,
            @RequestHeader(value = "X-Tenant-ID", required = false) String tenantSubdomain) {
        
        log.info("Download request for audio: {}", id);
        
        try {
            Audio audio = audioService.getAudioEntity(id);
            
            if (audio.getStorageKey() == null) {
                log.warn("Audio {} has no storage key", id);
                return ResponseEntity.notFound().build();
            }
            
            // For S3 storage, redirect to pre-signed URL
            if (storageService.isS3Storage()) {
                String presignedUrl = storageService.getFileUrl(audio.getStorageKey());
                return ResponseEntity.status(302)
                        .header(HttpHeaders.LOCATION, presignedUrl)
                        .build();
            }
            
            // For local storage, serve the file directly
            Resource resource = storageService.loadFileAsResource(audio.getStorageKey());
            
            // Use generic fallback instead of audio-specific default (supports video too)
            String contentType = audio.getMimeType() != null ? audio.getMimeType() : "application/octet-stream";
            String filename = audio.getOriginalFilename() != null ? audio.getOriginalFilename() : "media_file";
            
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .body(resource);
        } catch (Exception e) {
            log.error("Error downloading audio {}: {}", id, e.getMessage(), e);
            return ResponseEntity.notFound().build();
        }
    }

    @Operation(summary = "Upload new media file", description = "Upload an audio or video file with metadata. Requires ADMIN role. Saved as DRAFT status.")
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<?> uploadAudio(   
            @Parameter(description = "Media file (MP3, WAV, MP4, MKV, etc.)")
            @RequestPart("file") MultipartFile file,
            @Parameter(description = "Title of the audio")
            @RequestPart("title") String title,
            @Parameter(description = "Description (optional)")
            @RequestPart(value = "description", required = false) String description,
            @Parameter(description = "Speaker name (optional)")
            @RequestPart(value = "speaker", required = false) String speaker,
            @Parameter(description = "Existing speaker UUID (optional)")
            @RequestPart(value = "speakerId", required = false) String speakerId,
            @Parameter(description = "Category (optional)")
            @RequestPart(value = "category", required = false) String category,
            @Parameter(description = "Tag names (optional)")
            @RequestPart(value = "tags", required = false) List<String> tags,
            @Parameter(description = "Genre/category names (optional)")
            @RequestPart(value = "genres", required = false) List<String> genres,
            @Parameter(description = "Tenant subdomain (e.g., 'demo')")
            @RequestHeader(value = "X-Tenant-ID", required = false) String tenantSubdomain) throws IOException {
        
        // Resolve tenant ID from subdomain
        String subdomain = tenantSubdomain != null ? tenantSubdomain : "demo";
        Tenant tenant = tenantRepository.findBySubdomain(subdomain)
                .orElseThrow(() -> new RuntimeException("Tenant not found: " + subdomain));
        
        log.info("Uploading audio file: {} for tenant: {}", file.getOriginalFilename(), subdomain);
        
        String fileHash = AudioService.computeFileHash(file.getBytes());
        
        // Store the file first (before the temp file is consumed)
        String storageKey = storageService.storeFile(file, tenant.getId());
        
        // Get audio duration from stored file
        long durationSeconds = storageService.getAudioDuration(storageKey);
        
        try {
            AudioResponse response = audioService.createDraftWithFile(
                    title,
                    description,
                    speaker,
                    speakerId != null && !speakerId.isBlank() ? UUID.fromString(speakerId) : null,
                    category,
                    storageKey,
                    file.getOriginalFilename(),
                    file.getSize(),
                    file.getContentType(),
                    durationSeconds,
                    tenant.getId(),
                    fileHash             
            );
            bulkImportService.linkMetadataByNames(response.getId(), tenant.getId(), speaker, tags, genres);
            
            log.info("Audio uploaded successfully: {}", response.getId());
            return ResponseEntity.ok(response);
        } catch (AudioService.DuplicateFileException e) {

            log.warn("Duplicate upload rejected: {}", e.getMessage());
            return ResponseEntity.status(409).body(Map.of(
                    "error", "DUPLICATE_FILE",
                    "message", e.getMessage(),
                    "existingAudioId", e.getExistingAudioId().toString(),
                    "existingTitle", e.getExistingTitle()
            ));
        }
    }

    @Operation(summary = "Get all audio", description = "Get all audio files, optionally filtered by status. Requires ADMIN role.")
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<List<AudioResponse>> getAllAudio(
            @Parameter(description = "Filter by status: DRAFT, PUBLISHED, or ARCHIVED")
            @RequestParam(required = false) String status) {
        Audio.Status audioStatus = null;
        if (status != null) {
            audioStatus = Audio.Status.valueOf(status.toUpperCase());
        }
        return ResponseEntity.ok(audioService.getAllAudio(audioStatus));
    }

    @Operation(summary = "Get staging audio", description = "Get all audio in DRAFT status (staging area). Requires ADMIN role.")
    @GetMapping("/staging")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<List<AudioResponse>> getStagingAudio() {
        return ResponseEntity.ok(audioService.getStagingAudio());
    }

    @Operation(summary = "Get audio statistics", description = "Get counts of audio by status for dashboard. Requires ADMIN role.")
    @GetMapping("/stats")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<AudioService.AudioStats> getStats() {
        return ResponseEntity.ok(audioService.getStats());
    }

    @Operation(summary = "Update audio", description = "Update audio metadata (title, description, speaker, etc.). Requires ADMIN role.")
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<AudioResponse> updateAudio(
            @PathVariable UUID id,
            @RequestBody AudioUpdateRequest request) {
        return ResponseEntity.ok(audioService.updateAudio(id, request));
    }

    @Operation(summary = "Publish audio", description = "Move audio from DRAFT to PUBLISHED status. Requires ADMIN role.")
    @PostMapping("/{id}/publish")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<AudioResponse> publishAudio(@PathVariable UUID id) {
        return ResponseEntity.ok(audioService.publishAudio(id));
    }

    @Operation(summary = "Unpublish audio", description = "Move audio back to DRAFT status. Requires ADMIN role.")
    @PostMapping("/{id}/unpublish")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<AudioResponse> unpublishAudio(@PathVariable UUID id) {
        return ResponseEntity.ok(audioService.unpublishAudio(id));
    }

    @Operation(summary = "Archive audio", description = "Move audio to ARCHIVED status. Requires ADMIN role.")
    @PostMapping("/{id}/archive")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<AudioResponse> archiveAudio(@PathVariable UUID id) {
        return ResponseEntity.ok(audioService.archiveAudio(id));
    }

    @Operation(summary = "Delete audio", description = "Soft delete an audio file. Requires ADMIN role.")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<Void> deleteAudio(@PathVariable UUID id) {
        audioService.deleteAudio(id);
        return ResponseEntity.noContent().build();
    }


    @Operation(summary = "Bulk publish audio",
            description = "Publish multiple audio files at once (DRAFT → PUBLISHED). " +
                    "Each file is processed independently — one failure does not block others. Requires ADMIN role.")
    @PostMapping("/bulk-publish")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<AudioService.BulkActionResult> bulkPublish(
            @RequestBody List<UUID> audioIds) {

        if (audioIds == null || audioIds.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(audioService.bulkPublish(audioIds));
    }

    @Operation(summary = "Bulk unpublish audio",
            description = "Unpublish multiple audio files at once (PUBLISHED → DRAFT). " +
                    "Each file is processed independently. Requires ADMIN role.")
    @PostMapping("/bulk-unpublish")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<AudioService.BulkActionResult> bulkUnpublish(
            @RequestBody List<UUID> audioIds) {

        if (audioIds == null || audioIds.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(audioService.bulkUnpublish(audioIds));
    }

    @Operation(summary = "Bulk archive audio",
            description = "Archive multiple audio files at once (any status → ARCHIVED). " +
                    "Each file is processed independently. Requires ADMIN role.")
    @PostMapping("/bulk-archive")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<AudioService.BulkActionResult> bulkArchive(
            @RequestBody List<UUID> audioIds) {

        if (audioIds == null || audioIds.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(audioService.bulkArchive(audioIds));
    }
}
