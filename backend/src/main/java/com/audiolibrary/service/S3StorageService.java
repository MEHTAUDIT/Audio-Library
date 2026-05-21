package com.audiolibrary.service;

import com.audiolibrary.config.S3Properties;
import com.audiolibrary.dto.S3Dtos.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.ResponseInputStream;          
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.io.IOException;                                       
import java.security.DigestInputStream;                           
import java.security.MessageDigest;                               
import java.security.NoSuchAlgorithmException;                    
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Service for S3 storage operations including pre-signed URL generation.
 * Only active when app.s3.enabled=true.
 */
@Service
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "app.s3.enabled", havingValue = "true")
public class S3StorageService {

    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final S3Properties s3Properties;

    /**
     * Generate a pre-signed URL for uploading a file directly to S3.
     * 
     * @param tenantId The tenant's UUID
     * @param filename Original filename (used to determine extension)
     * @param contentType MIME type of the file
     * @return Pre-signed upload URL and the S3 key
     */
    public PresignedUploadResponse generateUploadUrl(UUID tenantId, String filename, String contentType) {
        log.debug("Generating pre-signed upload URL: tenant={} filename='{}' contentType={}",
                tenantId, filename, contentType);

        try {
            // Generate unique S3 key: prefix/tenantId/uuid.extension
            String extension = "";
            if (filename != null && filename.contains(".")) {
                extension = filename.substring(filename.lastIndexOf("."));
            }
            String uniqueFilename = UUID.randomUUID().toString() + extension;
            String s3Key = s3Properties.getPrefix() + tenantId.toString() + "/" + uniqueFilename;

            PutObjectRequest putRequest = PutObjectRequest.builder()
                    .bucket(s3Properties.getBucket())
                    .key(s3Key)
                    .contentType(contentType)
                    .build();

            PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                    .signatureDuration(Duration.ofMinutes(s3Properties.getUploadUrlExpirationMinutes()))
                    .putObjectRequest(putRequest)
                    .build();

            var presignedRequest = s3Presigner.presignPutObject(presignRequest);

            log.info("Generated pre-signed upload URL: tenant={} s3Key={} expiresInMinutes={}",
                    tenantId, s3Key, s3Properties.getUploadUrlExpirationMinutes());

            return PresignedUploadResponse.builder()
                    .uploadUrl(presignedRequest.url().toString())
                    .s3Key(s3Key)
                    .expiresAt(Instant.now().plusSeconds(s3Properties.getUploadUrlExpirationMinutes() * 60L))
                    .httpMethod("PUT")
                    .headers(java.util.Map.of("Content-Type", contentType))
                    .build();
        } catch (S3Exception e) {
            log.error("S3 operation failed generating upload URL: tenant={} filename='{}' errorCode={} statusCode={} message={}",
                    tenantId, filename,
                    e.awsErrorDetails() != null ? e.awsErrorDetails().errorCode() : "unknown",
                    e.statusCode(), e.getMessage(), e);
            throw e;
        } catch (Exception e) {
            log.error("Unexpected error generating upload URL: tenant={} filename='{}' error={}",
                    tenantId, filename, e.getMessage(), e);
            throw new RuntimeException("Failed to generate upload URL", e);
        }
    }

    /**
     * Generate multiple pre-signed URLs for batch upload.
     * 
     * @param tenantId The tenant's UUID
     * @param requests List of file upload requests
     * @return List of pre-signed upload URLs
     */
    public List<PresignedUploadResponse> generateBatchUploadUrls(UUID tenantId, List<UploadUrlRequest> requests) {
        List<PresignedUploadResponse> responses = new ArrayList<>();
        
        for (UploadUrlRequest request : requests) {
            PresignedUploadResponse response = generateUploadUrl(
                    tenantId, 
                    request.getFilename(), 
                    request.getContentType()
            );
            // Add original filename reference for client tracking
            response.setOriginalFilename(request.getFilename());
            responses.add(response);
        }
        
        log.info("Generated {} pre-signed upload URLs for tenant: {}", responses.size(), tenantId);
        return responses;
    }

    /**
     * Generate a pre-signed URL for downloading/streaming a file from S3.
     * 
     * @param s3Key The S3 object key
     * @return Pre-signed download URL
     */
    public String generateDownloadUrl(String s3Key) {
        GetObjectRequest getRequest = GetObjectRequest.builder()
                .bucket(s3Properties.getBucket())
                .key(s3Key)
                .build();
        
        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(s3Properties.getDownloadUrlExpirationMinutes()))
                .getObjectRequest(getRequest)
                .build();
        
        var presignedRequest = s3Presigner.presignGetObject(presignRequest);
        return presignedRequest.url().toString();
    }

    /**
     * Check if an object exists in S3.
     * 
     * @param s3Key The S3 object key
     * @return true if object exists
     */
    public boolean objectExists(String s3Key) {
        try {
            HeadObjectRequest headRequest = HeadObjectRequest.builder()
                    .bucket(s3Properties.getBucket())
                    .key(s3Key)
                    .build();
            s3Client.headObject(headRequest);
            return true;
        } catch (NoSuchKeyException e) {
            return false;
        }
    }

    /**
     * Get object metadata from S3.
     * 
     * @param s3Key The S3 object key
     * @return Object metadata including size and content type
     */
    public S3ObjectMetadata getObjectMetadata(String s3Key) {
        HeadObjectRequest headRequest = HeadObjectRequest.builder()
                .bucket(s3Properties.getBucket())
                .key(s3Key)
                .build();
        
        HeadObjectResponse response = s3Client.headObject(headRequest);
        
        return S3ObjectMetadata.builder()
                .s3Key(s3Key)
                .size(response.contentLength())
                .contentType(response.contentType())
                .lastModified(response.lastModified())
                .build();
    }

    /**
     * Compute SHA-256 hash of an S3 object by streaming its content.
     * Streams in 8KB chunks — does NOT load the entire file into memory.
     * Used for duplicate detection on S3-uploaded files.
     *
     * @param s3Key The S3 object key
     * @return SHA-256 hex string, or null if hashing fails
     */
    public String computeObjectHash(String s3Key) {
        log.debug("Computing SHA-256 hash for S3 object: {}", s3Key);

        GetObjectRequest getRequest = GetObjectRequest.builder()
                .bucket(s3Properties.getBucket())
                .key(s3Key)
                .build();

        try (ResponseInputStream<GetObjectResponse> s3InputStream = s3Client.getObject(getRequest)) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (DigestInputStream dis = new DigestInputStream(s3InputStream, digest)) {
                byte[] buffer = new byte[8192];
                while (dis.read(buffer) != -1) {
                    // reading through to compute hash
                }
            }
            byte[] hashBytes = digest.digest();
            StringBuilder hex = new StringBuilder();
            for (byte b : hashBytes) {
                hex.append(String.format("%02x", b));
            }
            String hash = hex.toString();
            log.debug("Computed hash for S3 object {}: {}", s3Key, hash);
            return hash;
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        } catch (IOException e) {
            log.error("Failed to compute hash for S3 object {}: {}", s3Key, e.getMessage(), e);
            return null;
        } catch (S3Exception e) {
            log.error("S3 error computing hash for object {}: statusCode={} errorCode={} message={}",
                    s3Key, e.statusCode(),
                    e.awsErrorDetails() != null ? e.awsErrorDetails().errorCode() : "unknown",
                    e.getMessage(), e);
            return null;
        }
    }

    /**
     * List all objects in a tenant's folder.
     * Used for bulk import scanning of S3 paths.
     * 
     * @param tenantId The tenant's UUID
     * @param subPath Optional sub-path within tenant folder
     * @return List of S3 object keys
     */
    public List<S3ObjectInfo> listTenantObjects(UUID tenantId, String subPath) {
        String prefix = s3Properties.getPrefix() + tenantId.toString() + "/";
        if (subPath != null && !subPath.isEmpty()) {
            prefix += subPath;
            if (!prefix.endsWith("/")) {
                prefix += "/";
            }
        }
        
        log.debug("Listing S3 objects with prefix: {}", prefix);
        
        ListObjectsV2Request listRequest = ListObjectsV2Request.builder()
                .bucket(s3Properties.getBucket())
                .prefix(prefix)
                .build();
        
        List<S3ObjectInfo> objects = new ArrayList<>();
        ListObjectsV2Response response;
        
        do {
            response = s3Client.listObjectsV2(listRequest);
            
            for (S3Object s3Object : response.contents()) {
                // Skip "folder" objects
                if (!s3Object.key().endsWith("/")) {
                    objects.add(S3ObjectInfo.builder()
                            .s3Key(s3Object.key())
                            .size(s3Object.size())
                            .lastModified(s3Object.lastModified())
                            .filename(extractFilename(s3Object.key()))
                            .build());
                }
            }
            
            // Handle pagination
            listRequest = listRequest.toBuilder()
                    .continuationToken(response.nextContinuationToken())
                    .build();
                    
        } while (response.isTruncated());
        
        log.info("Found {} objects in S3 for tenant: {}", objects.size(), tenantId);
        return objects;
    }

    /**
     * Delete an object from S3.
     * 
     * @param s3Key The S3 object key
     */
    public void deleteObject(String s3Key) {
        DeleteObjectRequest deleteRequest = DeleteObjectRequest.builder()
                .bucket(s3Properties.getBucket())
                .key(s3Key)
                .build();
        
        s3Client.deleteObject(deleteRequest);
        log.info("Deleted S3 object: {}", s3Key);
    }

    /**
     * Copy an object within S3 (e.g., from staging to permanent location).
     * 
     * @param sourceKey Source S3 key
     * @param destinationKey Destination S3 key
     */
    public void copyObject(String sourceKey, String destinationKey) {
        CopyObjectRequest copyRequest = CopyObjectRequest.builder()
                .sourceBucket(s3Properties.getBucket())
                .sourceKey(sourceKey)
                .destinationBucket(s3Properties.getBucket())
                .destinationKey(destinationKey)
                .build();
        
        s3Client.copyObject(copyRequest);
        log.info("Copied S3 object from {} to {}", sourceKey, destinationKey);
    }

    private String extractFilename(String s3Key) {
        int lastSlash = s3Key.lastIndexOf('/');
        return lastSlash >= 0 ? s3Key.substring(lastSlash + 1) : s3Key;
    }

    // ==================== STAGING METHODS ====================

    /**
     * Generate a pre-signed URL for uploading to the staging area.
     * Files in staging are not yet processed/confirmed.
     */
    public PresignedUploadResponse generateStagingUploadUrl(UUID tenantId, String filename, String contentType) {
        String extension = "";
        if (filename != null && filename.contains(".")) {
            extension = filename.substring(filename.lastIndexOf("."));
        }
        String uniqueFilename = UUID.randomUUID().toString() + extension;
        String s3Key = s3Properties.getStagingPrefix() + tenantId.toString() + "/" + uniqueFilename;
        
        log.debug("Generating staging upload URL for key: {}", s3Key);
        
        PutObjectRequest putRequest = PutObjectRequest.builder()
                .bucket(s3Properties.getBucket())
                .key(s3Key)
                .contentType(contentType)
                // Store original filename as metadata
                .metadata(java.util.Map.of("original-filename", filename != null ? filename : "unknown"))
                .build();
        
        PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(s3Properties.getUploadUrlExpirationMinutes()))
                .putObjectRequest(putRequest)
                .build();
        
        var presignedRequest = s3Presigner.presignPutObject(presignRequest);
        
        return PresignedUploadResponse.builder()
                .uploadUrl(presignedRequest.url().toString())
                .s3Key(s3Key)
                .expiresAt(Instant.now().plusSeconds(s3Properties.getUploadUrlExpirationMinutes() * 60L))
                .httpMethod("PUT")
                .headers(java.util.Map.of("Content-Type", contentType))
                .originalFilename(filename)
                .build();
    }

    /**
     * Generate batch staging upload URLs.
     */
    public List<PresignedUploadResponse> generateBatchStagingUploadUrls(UUID tenantId, List<UploadUrlRequest> requests) {
        List<PresignedUploadResponse> responses = new ArrayList<>();
        
        for (UploadUrlRequest request : requests) {
            PresignedUploadResponse response = generateStagingUploadUrl(
                    tenantId, 
                    request.getFilename(), 
                    request.getContentType()
            );
            responses.add(response);
        }
        
        log.info("Generated {} staging upload URLs for tenant: {}", responses.size(), tenantId);
        return responses;
    }

    /**
     * List all files in the staging area for a tenant.
     */
    public List<S3ObjectInfo> listStagingFiles(UUID tenantId) {
        String prefix = s3Properties.getStagingPrefix() + tenantId.toString() + "/";
        
        log.debug("Listing staging files with prefix: {}", prefix);
        
        ListObjectsV2Request listRequest = ListObjectsV2Request.builder()
                .bucket(s3Properties.getBucket())
                .prefix(prefix)
                .build();
        
        List<S3ObjectInfo> objects = new ArrayList<>();
        ListObjectsV2Response response;
        
        do {
            response = s3Client.listObjectsV2(listRequest);
            
            for (S3Object s3Object : response.contents()) {
                if (!s3Object.key().endsWith("/")) {
                    // Try to get original filename from metadata
                    String originalFilename = getOriginalFilename(s3Object.key());
                    
                    objects.add(S3ObjectInfo.builder()
                            .s3Key(s3Object.key())
                            .size(s3Object.size())
                            .lastModified(s3Object.lastModified())
                            .filename(originalFilename != null ? originalFilename : extractFilename(s3Object.key()))
                            .build());
                }
            }
            
            listRequest = listRequest.toBuilder()
                    .continuationToken(response.nextContinuationToken())
                    .build();
                    
        } while (response.isTruncated());
        
        log.info("Found {} files in staging for tenant: {}", objects.size(), tenantId);
        return objects;
    }

    /**
     * Get the original filename from S3 object metadata.
     */
    private String getOriginalFilename(String s3Key) {
        try {
            HeadObjectRequest headRequest = HeadObjectRequest.builder()
                    .bucket(s3Properties.getBucket())
                    .key(s3Key)
                    .build();
            HeadObjectResponse response = s3Client.headObject(headRequest);
            return response.metadata().get("original-filename");
        } catch (Exception e) {
            log.debug("Could not get original filename for {}: {}", s3Key, e.getMessage());
            return null;
        }
    }

    /**
     * Move a file from staging to permanent storage.
     * 
     * @param stagingKey The S3 key in staging area
     * @param tenantId The tenant's UUID
     * @return The new permanent S3 key
     */
    public String moveFromStagingToPermanent(String stagingKey, UUID tenantId) {
        // Generate new permanent key
        String filename = extractFilename(stagingKey);
        String permanentKey = s3Properties.getPrefix() + tenantId.toString() + "/" + filename;
        
        // Copy to permanent location
        copyObject(stagingKey, permanentKey);
        
        // Delete from staging
        deleteObject(stagingKey);
        
        log.info("Moved file from staging to permanent: {} -> {}", stagingKey, permanentKey);
        return permanentKey;
    }

    /**
     * Clear all staging files for a tenant (e.g., if upload is cancelled).
     */
    public int clearStagingFiles(UUID tenantId) {
        List<S3ObjectInfo> stagingFiles = listStagingFiles(tenantId);
        
        for (S3ObjectInfo file : stagingFiles) {
            deleteObject(file.getS3Key());
        }
        
        log.info("Cleared {} staging files for tenant: {}", stagingFiles.size(), tenantId);
        return stagingFiles.size();
    }
}