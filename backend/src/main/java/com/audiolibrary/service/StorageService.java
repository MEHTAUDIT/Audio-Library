package com.audiolibrary.service;

import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Path;
import java.util.UUID;

/**
 * Interface for storage operations.
 * Implementations can be local filesystem or S3.
 */
public interface StorageService {
    
    /**
     * Store a file and return the storage key.
     * 
     * @param file The uploaded file
     * @param tenantId The tenant's UUID
     * @return Storage key (path or S3 key)
     */
    String storeFile(MultipartFile file, UUID tenantId) throws IOException;
    
    /**
     * Store a file from an existing filesystem path.
     * Used for bulk imports from server paths.
     * 
     * @param sourcePath Source file path
     * @param tenantId The tenant's UUID
     * @return Storage key
     */
    String storeFileFromPath(Path sourcePath, UUID tenantId) throws IOException;
    
    /**
     * Get a URL for streaming/downloading a file.
     * For S3, this returns a pre-signed URL.
     * For local, this might return a relative path or direct URL.
     * 
     * @param storageKey The storage key
     * @return URL string for accessing the file
     */
    String getFileUrl(String storageKey);
    
    /**
     * Load a file as a Resource (for local streaming).
     * For S3, this may redirect to a pre-signed URL instead.
     * 
     * @param storageKey The storage key
     * @return Resource for streaming
     */
    Resource loadFileAsResource(String storageKey);
    
    /**
     * Get audio duration in seconds.
     * 
     * @param storageKey The storage key
     * @return Duration in seconds, or 0 if unknown
     */
    long getAudioDuration(String storageKey);
    
    /**
     * Delete a file.
     * 
     * @param storageKey The storage key
     * @return true if deleted successfully
     */
    boolean deleteFile(String storageKey);
    
    /**
     * Check if a file exists.
     * 
     * @param storageKey The storage key
     * @return true if file exists
     */
    boolean fileExists(String storageKey);
    
    /**
     * Check if this is S3 storage.
     * 
     * @return true if using S3, false for local
     */
    boolean isS3Storage();
}

