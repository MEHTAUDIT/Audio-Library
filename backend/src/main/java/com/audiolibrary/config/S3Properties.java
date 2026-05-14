package com.audiolibrary.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuration properties for AWS S3 storage.
 * 
 * Set these in application.yml or via environment variables:
 * - AWS_ACCESS_KEY_ID / app.s3.access-key
 * - AWS_SECRET_ACCESS_KEY / app.s3.secret-key
 * - app.s3.bucket
 * - app.s3.region
 */
@Data
@Component
@ConfigurationProperties(prefix = "app.s3")
public class S3Properties {
    
    /**
     * Whether S3 storage is enabled. If false, local file storage is used.
     */
    private boolean enabled = false;
    
    /**
     * AWS region (e.g., us-east-1, eu-west-1)
     */
    private String region = "us-east-1";
    
    /**
     * S3 bucket name for storing audio files
     */
    private String bucket;
    
    /**
     * AWS access key ID (optional if using IAM roles or environment credentials)
     */
    private String accessKey;
    
    /**
     * AWS secret access key (optional if using IAM roles or environment credentials)
     */
    private String secretKey;
    
    /**
     * Prefix for all stored files (e.g., "audio/" or "uploads/")
     */
    private String prefix = "audio/";
    
    /**
     * Prefix for staging area (files uploaded but not yet processed)
     */
    private String stagingPrefix = "staging/";
    
    /**
     * Pre-signed URL expiration time in minutes for uploads
     */
    private int uploadUrlExpirationMinutes = 60;
    
    /**
     * Pre-signed URL expiration time in minutes for downloads
     */
    private int downloadUrlExpirationMinutes = 60;
    
    /**
     * Maximum file size allowed for upload (in bytes). Default 2GB.
     */
    private long maxFileSize = 2L * 1024 * 1024 * 1024;
}

