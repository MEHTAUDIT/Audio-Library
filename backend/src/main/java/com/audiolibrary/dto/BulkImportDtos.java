package com.audiolibrary.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * DTOs for Bulk Import functionality.
 * These mirror the frontend types in bulkImport.ts for shared logic.
 */
public class BulkImportDtos {

    // ==================== Request DTOs ====================

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ScanRequest {
        private String sourcePath;
        private String sourceType; // "path" or "zip"
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ExecuteRequest {
        private String sourcePath;
        private String sourceType;
        private FolderStructureMapping mapping;
        private List<MappedAudioFile> files;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SingleFileImportRequest {
        private String sourcePath;
        private MappedAudioFile file;
    }

    // ==================== Response DTOs ====================

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ScanResponse {
        private DetectedStructure structure;
        private FolderStructureMapping suggestedMapping;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class JobStatus {
        private String jobId;
        private String status; // pending, processing, completed, failed
        private int totalFiles;
        private int processedFiles;
        private int successCount;
        private int errorCount;
        private List<ImportError> errors;
        private String startedAt;
        private String completedAt;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ImportError {
        private String file;
        private String error;
    }

    // ==================== Structure DTOs ====================

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DetectedStructure {
        private String rootPath;
        private List<DetectedLevel> levels;
        private int totalFiles;
        private List<String> sampleFiles;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DetectedLevel {
        private int depth;
        private List<String> sampleValues;
        private int totalFolders;
    }

    // ==================== Mapping DTOs ====================

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class FolderStructureMapping {
        private List<LevelConfig> levels;
        private FilenamePattern filenamePattern;
        private String combineSeparator;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class LevelConfig {
        private int depth;
        private List<String> sampleValues;
        private LevelMapping mapping;
        private LevelMapping suggestedMapping;
        private Double confidence;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class LevelMapping {
        private String type; // "map_to_field", "append_to_field", "skip", "filename"
        private String field; // "speaker", "topic", "language", "series", "title"
        private String separator; // For append_to_field
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class FilenamePattern {
        private boolean enabled;
        private String template;
        private String regex;
    }

    // ==================== File DTOs ====================

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class MappedAudioFile {
        private String originalPath;
        private String relativePath;
        private String filename;
        
        // Extracted metadata
        private String title;
        private String speaker;
        private String topic;
        private String language;
        private String series;

        private List<String> tags;     // e.g. ["sermons", "sunday", "faith"]
        private List<String> genres;   // e.g. ["Religious", "Educational"]
        
        // File info
        private Long sizeBytes;
        
        // Editing state
        private Boolean isEdited;
        private List<String> validationErrors;
    }

    // ==================== Presets ====================

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class MappingPreset {
        private String id;
        private String name;
        private String description;
        private List<PresetLevel> levels;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class PresetLevel {
        private int depth;
        private LevelMapping mapping;
    }
}