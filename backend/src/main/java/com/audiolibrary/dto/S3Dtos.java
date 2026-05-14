package com.audiolibrary.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * DTOs for S3 storage operations.
 */
public class S3Dtos {

    /**
     * Request for a single pre-signed upload URL.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UploadUrlRequest {
        private String filename;
        private String contentType;
        private Long fileSize;
    }

    /**
     * Request for batch pre-signed upload URLs.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BatchUploadUrlRequest {
        private List<UploadUrlRequest> files;
    }

    /**
     * Response containing a pre-signed upload URL.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PresignedUploadResponse {
        /**
         * The pre-signed URL for uploading directly to S3.
         */
        private String uploadUrl;
        
        /**
         * The S3 key where the file will be stored.
         * Save this - you'll need it to reference the file later.
         */
        private String s3Key;
        
        /**
         * When the pre-signed URL expires.
         */
        private Instant expiresAt;
        
        /**
         * HTTP method to use (always PUT for uploads).
         */
        private String httpMethod;
        
        /**
         * Headers that must be included in the upload request.
         */
        private Map<String, String> headers;
        
        /**
         * Original filename (for client-side tracking in batch operations).
         */
        private String originalFilename;
    }

    /**
     * Response for batch upload URL generation.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BatchUploadUrlResponse {
        private List<PresignedUploadResponse> uploads;
        private int totalFiles;
    }

    /**
     * Request to confirm upload completion and create audio record.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ConfirmUploadRequest {
        /**
         * The S3 key returned from the upload URL generation.
         */
        private String s3Key;
        
        /**
         * Original filename.
         */
        private String filename;
        
        /**
         * Audio title (optional, derived from filename if not provided).
         */
        private String title;
        
        /**
         * Speaker name.
         */
        private String speaker;
        
        /**
         * Topic/category.
         */
        private String topic;
        
        /**
         * Series name.
         */
        private String series;
        
        /**
         * Description.
         */
        private String description;
    }

    /**
     * Request to confirm multiple uploads at once.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BatchConfirmUploadRequest {
        private List<ConfirmUploadRequest> files;
    }

    /**
     * S3 object metadata.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class S3ObjectMetadata {
        private String s3Key;
        private Long size;
        private String contentType;
        private Instant lastModified;
    }

    /**
     * S3 object information for listing.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class S3ObjectInfo {
        private String s3Key;
        private String filename;
        private Long size;
        private Instant lastModified;
    }

    /**
     * Response for listing S3 objects.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ListObjectsResponse {
        private List<S3ObjectInfo> objects;
        private int totalCount;
        private String prefix;
    }

    // ==================== STAGING DTOs ====================

    /**
     * Response for staging status after upload complete.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StagingStatusResponse {
        private String tenantId;
        private int filesInStaging;
        private List<S3ObjectInfo> files;
        private String status;
    }

    /**
     * Metadata for a file being processed from staging.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StagingFileMetadata {
        /**
         * The S3 key in the staging area.
         */
        private String stagingKey;
        
        /**
         * Original filename.
         */
        private String filename;
        
        /**
         * Audio title.
         */
        private String title;
        
        /**
         * Speaker name.
         */
        private String speaker;
        
        /**
         * Topic/category.
         */
        private String topic;
        
        /**
         * Series name.
         */
        private String series;
        
        /**
         * Description.
         */
        private String description;
    }

    /**
     * Request to process files from staging.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProcessStagingRequest {
        private List<StagingFileMetadata> files;
    }

    /**
     * Response for clearing staging area.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ClearStagingResponse {
        private int deletedCount;
        private String message;
    }
}

