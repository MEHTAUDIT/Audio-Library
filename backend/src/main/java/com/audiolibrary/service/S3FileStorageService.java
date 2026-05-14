package com.audiolibrary.service;

import com.audiolibrary.config.S3Properties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.UUID;

/**
 * S3 storage implementation.
 * Active when app.s3.enabled=true.
 */
@Service
@Slf4j
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.s3.enabled", havingValue = "true")
public class S3FileStorageService implements StorageService {

    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final S3Properties s3Properties;

    @Override
    public String storeFile(MultipartFile file, UUID tenantId) throws IOException {
        String originalFilename = file.getOriginalFilename();
        String extension = "";
        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf("."));
        }
        String filename = UUID.randomUUID().toString() + extension;
        String s3Key = s3Properties.getPrefix() + tenantId.toString() + "/" + filename;
        
        log.info("Uploading to S3: {} -> {}", originalFilename, s3Key);
        
        PutObjectRequest putRequest = PutObjectRequest.builder()
                .bucket(s3Properties.getBucket())
                .key(s3Key)
                .contentType(file.getContentType())
                .contentLength(file.getSize())
                .build();
        
        try (InputStream inputStream = file.getInputStream()) {
            s3Client.putObject(putRequest, RequestBody.fromInputStream(inputStream, file.getSize()));
        }
        
        log.info("Uploaded to S3: {}", s3Key);
        return s3Key;
    }

    @Override
    public String storeFileFromPath(Path sourcePath, UUID tenantId) throws IOException {
        String originalFilename = sourcePath.getFileName().toString();
        String extension = "";
        if (originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf("."));
        }
        String filename = UUID.randomUUID().toString() + extension;
        String s3Key = s3Properties.getPrefix() + tenantId.toString() + "/" + filename;
        
        log.info("Uploading file from path to S3: {} -> {}", sourcePath, s3Key);
        
        String contentType = Files.probeContentType(sourcePath);
        if (contentType == null) {
            contentType = "audio/mpeg";
        }
        
        PutObjectRequest putRequest = PutObjectRequest.builder()
                .bucket(s3Properties.getBucket())
                .key(s3Key)
                .contentType(contentType)
                .build();
        
        s3Client.putObject(putRequest, sourcePath);
        
        log.info("Uploaded to S3: {}", s3Key);
        return s3Key;
    }

    @Override
    public String getFileUrl(String storageKey) {
        // Generate pre-signed URL for streaming
        GetObjectRequest getRequest = GetObjectRequest.builder()
                .bucket(s3Properties.getBucket())
                .key(storageKey)
                .build();
        
        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(s3Properties.getDownloadUrlExpirationMinutes()))
                .getObjectRequest(getRequest)
                .build();
        
        return s3Presigner.presignGetObject(presignRequest).url().toString();
    }

    @Override
    public Resource loadFileAsResource(String storageKey) {
        // For S3, we redirect to pre-signed URL instead of serving directly
        // This method shouldn't be called in S3 mode - use getFileUrl instead
        throw new UnsupportedOperationException(
                "Direct file loading not supported for S3. Use getFileUrl() to get a pre-signed URL.");
    }

    @Override
    public long getAudioDuration(String storageKey) {
        // For S3, duration detection would require downloading the file
        // Return 0 and calculate duration later if needed
        log.debug("Audio duration detection not available for S3 storage");
        return 0;
    }

    @Override
    public boolean deleteFile(String storageKey) {
        try {
            DeleteObjectRequest deleteRequest = DeleteObjectRequest.builder()
                    .bucket(s3Properties.getBucket())
                    .key(storageKey)
                    .build();
            
            s3Client.deleteObject(deleteRequest);
            log.info("Deleted from S3: {}", storageKey);
            return true;
        } catch (Exception e) {
            log.error("Failed to delete from S3: {}", storageKey, e);
            return false;
        }
    }

    @Override
    public boolean fileExists(String storageKey) {
        try {
            HeadObjectRequest headRequest = HeadObjectRequest.builder()
                    .bucket(s3Properties.getBucket())
                    .key(storageKey)
                    .build();
            s3Client.headObject(headRequest);
            return true;
        } catch (NoSuchKeyException e) {
            return false;
        }
    }

    @Override
    public boolean isS3Storage() {
        return true;
    }
}

