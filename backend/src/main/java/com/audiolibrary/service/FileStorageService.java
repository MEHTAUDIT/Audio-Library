package com.audiolibrary.service;

import com.mpatric.mp3agic.Mp3File;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.InputStream;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

/**
 * Local filesystem storage implementation.
 * Active when S3 is not enabled (default).
 */
@Service
@Slf4j
@ConditionalOnProperty(name = "app.s3.enabled", havingValue = "false", matchIfMissing = true)
public class FileStorageService implements StorageService {

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    private Path uploadPath;

    @PostConstruct
    public void init() {
        this.uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.uploadPath);
            log.info("Local storage initialized at: {}", this.uploadPath);
        } catch (IOException e) {
            throw new RuntimeException("Could not create upload directory", e);
        }
    }

    @Override
    public String storeFileFromPath(Path sourcePath, UUID tenantId) throws IOException {
        String originalFilename = sourcePath.getFileName().toString();
        String extension = "";
        if (originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf("."));
        }
        String filename = UUID.randomUUID().toString() + extension;
        
        Path tenantDir = this.uploadPath.resolve(tenantId.toString());
        Files.createDirectories(tenantDir);
        
        Path targetPath = tenantDir.resolve(filename);
        Files.copy(sourcePath, targetPath, StandardCopyOption.REPLACE_EXISTING);
        
        String storageKey = tenantId.toString() + "/" + filename;
        log.info("Stored file from path: {} -> {}", originalFilename, storageKey);
        
        return storageKey;
    }

    @Override
    public String storeFile(MultipartFile file, UUID tenantId) throws IOException {
        String originalFilename = file.getOriginalFilename();
        String extension = "";
        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf("."));
        }
        String filename = UUID.randomUUID().toString() + extension;
        
        Path tenantDir = this.uploadPath.resolve(tenantId.toString());
        Files.createDirectories(tenantDir);
        
        Path targetPath = tenantDir.resolve(filename);
        try (InputStream inputStream = file.getInputStream()) {
            Files.copy(inputStream, targetPath, StandardCopyOption.REPLACE_EXISTING);
        }
        
        String storageKey = tenantId.toString() + "/" + filename;
        log.info("Stored file: {} -> {}", originalFilename, storageKey);
        
        return storageKey;
    }

    @Override
    public String getFileUrl(String storageKey) {
        // For local storage, return relative path for the streaming endpoint
        return "/api/v1/audio/stream/" + storageKey;
    }

    @Override
    public Resource loadFileAsResource(String storageKey) {
        try {
            Path filePath = this.uploadPath.resolve(storageKey).normalize();
            Resource resource = new UrlResource(filePath.toUri());
            
            if (resource.exists() && resource.isReadable()) {
                return resource;
            } else {
                throw new RuntimeException("File not found: " + storageKey);
            }
        } catch (MalformedURLException e) {
            throw new RuntimeException("File not found: " + storageKey, e);
        }
    }

    @Override
    public long getAudioDuration(String storageKey) {
        try {
            Path filePath = this.uploadPath.resolve(storageKey).normalize();
            
            if (storageKey.toLowerCase().endsWith(".mp3")) {
                Mp3File mp3File = new Mp3File(filePath.toFile());
                long durationSeconds = mp3File.getLengthInSeconds();
                log.debug("Detected MP3 duration: {} seconds", durationSeconds);
                return durationSeconds;
            }
            
            // CHANGED: Use ffprobe to detect video duration (was: return 0)
            // ffprobe is typically available on Linux servers with ffmpeg installed.
            // Falls back to 0 if ffprobe is not installed or fails.
            String lower = storageKey.toLowerCase();
            if (lower.endsWith(".mp4") || lower.endsWith(".mkv") || lower.endsWith(".avi") ||
                lower.endsWith(".mov") || lower.endsWith(".webm") || lower.endsWith(".wmv") ||
                lower.endsWith(".m4v")) {
                return getMediaDurationViaFfprobe(filePath);
            }
            
            // For other audio formats, estimate based on file size
            long fileSizeBytes = Files.size(filePath);
            long estimatedSeconds = fileSizeBytes / 16000;
            log.debug("Estimated audio duration: {} seconds", estimatedSeconds);
            return estimatedSeconds;
            
        } catch (Exception e) {
            log.warn("Could not determine audio duration: {}", e.getMessage());
            return 0;
        }
    }

    /**
     *  Use ffprobe (from FFmpeg) to detect media duration for video files.
     * Runs: ffprobe -v error -show_entries format=duration -of csv=p=0 <file>
     * Returns duration in seconds, or 0 if ffprobe is not installed or fails.
     */
    private long getMediaDurationViaFfprobe(Path filePath) {
        try {
            ProcessBuilder pb = new ProcessBuilder(
                    "ffprobe",
                    "-v", "error",
                    "-show_entries", "format=duration",
                    "-of", "csv=p=0",
                    filePath.toAbsolutePath().toString()
            );
            pb.redirectErrorStream(true);
            Process process = pb.start();

            String output = new String(process.getInputStream().readAllBytes()).trim();
            int exitCode = process.waitFor();

            if (exitCode == 0 && !output.isEmpty()) {
                double durationSeconds = Double.parseDouble(output);
                long rounded = Math.round(durationSeconds);
                log.debug("FFprobe detected duration: {}s for {}", rounded, filePath.getFileName());
                return rounded;
            } else {
                log.warn("FFprobe returned exit code {} for {}", exitCode, filePath.getFileName());
                return 0;
            }
        } catch (java.io.IOException e) {
            log.debug("FFprobe not available, cannot detect video duration: {}", e.getMessage());
            return 0;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("FFprobe interrupted for {}", filePath.getFileName());
            return 0;
        } catch (NumberFormatException e) {
            log.warn("FFprobe returned non-numeric duration for {}: {}", filePath.getFileName(), e.getMessage());
            return 0;
        }
    }

    @Override
    public boolean deleteFile(String storageKey) {
        try {
            Path filePath = this.uploadPath.resolve(storageKey).normalize();
            return Files.deleteIfExists(filePath);
        } catch (IOException e) {
            log.error("Failed to delete file: {}", storageKey, e);
            return false;
        }
    }

    @Override
    public boolean fileExists(String storageKey) {
        Path filePath = this.uploadPath.resolve(storageKey).normalize();
        return Files.exists(filePath);
    }

    @Override
    public boolean isS3Storage() {
        return false;
    }

    /**
     * Get the full path for a storage key (local storage only).
     */
    public Path getFilePath(String storageKey) {
        return this.uploadPath.resolve(storageKey).normalize();
    }
}