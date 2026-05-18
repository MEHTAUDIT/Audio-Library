package com.audiolibrary.service;

import com.audiolibrary.dto.BulkImportDtos.*;
import com.audiolibrary.entity.Audio;
import com.audiolibrary.repository.AudioRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Service for bulk importing audio files from folder structures.
 * This logic mirrors the frontend bulkImportUtils.ts for consistency.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class BulkImportService {

    private final AudioService audioService;
    private final StorageService storageService;
    private final AudioRepository audioRepository;

    // Supported audio file extensions
    private static final Set<String> AUDIO_EXTENSIONS = Set.of(
            ".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac", ".wma"
    );

    // Patterns for detecting speaker names
    private static final List<Pattern> SPEAKER_PATTERNS = List.of(
            Pattern.compile("^(Rabbi|Rav|Dr\\.?|Rev\\.?|Pastor|Imam|Sheikh|Harav|Reb|Mr\\.?|Mrs\\.?|Ms\\.?)\\s", Pattern.CASE_INSENSITIVE),
            Pattern.compile("^[A-Z][a-z]+\\s+[A-Z][a-z]+$"),
            Pattern.compile("^[A-Z][a-z]+\\s+[A-Z]\\.\\s+[A-Z][a-z]+$")
    );

    // Language codes
    private static final Set<String> LANGUAGE_CODES = Set.of(
            "en", "he", "yi", "es", "fr", "de", "english", "hebrew", "yiddish", "spanish", "french", "german"
    );

    // Generic folder names to skip
    private static final Set<String> SKIP_PATTERNS = Set.of(
            "audio", "files", "uploads", "library", "content", "media"
    );

    public boolean isAudioFile(String filename) {
        String lower = filename.toLowerCase();
        return AUDIO_EXTENSIONS.stream().anyMatch(lower::endsWith);
    }

    public ScanResponse scanDirectory(String sourcePath) throws IOException {
        Path rootPath = Paths.get(sourcePath);
        
        if (!Files.exists(rootPath)) {
            throw new IllegalArgumentException("Path does not exist: " + sourcePath);
        }
        if (!Files.isDirectory(rootPath)) {
            throw new IllegalArgumentException("Path is not a directory: " + sourcePath);
        }

        log.info("Scanning directory: {}", sourcePath);

        List<Path> audioFiles = new ArrayList<>();
        Files.walkFileTree(rootPath, new SimpleFileVisitor<>() {
            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
                if (isAudioFile(file.getFileName().toString())) {
                    audioFiles.add(file);
                }
                return FileVisitResult.CONTINUE;
            }
        });

        log.info("Found {} audio files", audioFiles.size());

        if (audioFiles.isEmpty()) {
            return ScanResponse.builder()
                    .structure(DetectedStructure.builder()
                            .rootPath(sourcePath)
                            .levels(Collections.emptyList())
                            .totalFiles(0)
                            .sampleFiles(Collections.emptyList())
                            .build())
                    .suggestedMapping(FolderStructureMapping.builder()
                            .levels(Collections.emptyList())
                            .combineSeparator(" > ")
                            .build())
                    .build();
        }

        DetectedStructure structure = analyzeStructure(rootPath, audioFiles);
        FolderStructureMapping suggestedMapping = buildSuggestedMapping(structure);

        return ScanResponse.builder()
                .structure(structure)
                .suggestedMapping(suggestedMapping)
                .build();
    }

    private DetectedStructure analyzeStructure(Path rootPath, List<Path> audioFiles) {
        List<List<String>> pathParts = audioFiles.stream()
                .map(f -> {
                    Path relative = rootPath.relativize(f);
                    List<String> parts = new ArrayList<>();
                    for (Path part : relative) {
                        parts.add(part.toString());
                    }
                    return parts;
                })
                .collect(Collectors.toList());

        int maxDepth = pathParts.stream()
                .mapToInt(List::size)
                .max()
                .orElse(0);

        Map<Integer, Set<String>> levelMap = new HashMap<>();
        for (List<String> parts : pathParts) {
            for (int i = 0; i < parts.size() - 1; i++) {
                levelMap.computeIfAbsent(i, k -> new LinkedHashSet<>()).add(parts.get(i));
            }
        }

        List<DetectedLevel> levels = new ArrayList<>();
        for (int i = 0; i < maxDepth - 1; i++) {
            Set<String> values = levelMap.get(i);
            if (values != null) {
                levels.add(DetectedLevel.builder()
                        .depth(i)
                        .sampleValues(values.stream().limit(10).collect(Collectors.toList()))
                        .totalFolders(values.size())
                        .build());
            }
        }

        List<String> sampleFiles = audioFiles.stream()
                .limit(10)
                .map(f -> rootPath.relativize(f).toString())
                .collect(Collectors.toList());

        return DetectedStructure.builder()
                .rootPath(rootPath.toString())
                .levels(levels)
                .totalFiles(audioFiles.size())
                .sampleFiles(sampleFiles)
                .build();
    }
    /**
     * Suggest mapping based on heuristics from folder names
     */
    private LevelMapping suggestMappingForLevel(List<String> sampleValues, int depth, int totalLevels) {
        // Check for speaker-like names
        long speakerMatches = sampleValues.stream()
                .filter(v -> SPEAKER_PATTERNS.stream().anyMatch(p -> p.matcher(v).find()))
                .count();

        if (speakerMatches >= sampleValues.size() * 0.5) {
            return LevelMapping.builder()
                    .type("map_to_field")
                    .field("speaker")
                    .build();
        }

        // Check for year-like values
        if (sampleValues.stream().allMatch(v -> v.matches("^(19|20)\\d{2}$"))) {
            return LevelMapping.builder()
                .type("skip")
                .build();
        }

        // Check for language codes
        if (sampleValues.stream().allMatch(v -> LANGUAGE_CODES.contains(v.toLowerCase()))) {
            return LevelMapping.builder()
                    .type("map_to_field")
                    .field("language")
                    .build();
        }

        // Check for generic organizational folders
        if (sampleValues.size() == 1 &&
            SKIP_PATTERNS.stream().anyMatch(p -> sampleValues.get(0).toLowerCase().contains(p))) {
            return LevelMapping.builder()
                .type("skip")
                .build();
        }

        // Default: first level is speaker, rest is topic
        if (depth == 0) {
            return LevelMapping.builder()
                    .type("map_to_field")
                    .field("speaker")
                    .build();
        }

        return LevelMapping.builder()
                .type("map_to_field")
                .field("topic")
                .build();
    }

    /**
     * Build suggested mapping configuration from detected structure
     */
    private FolderStructureMapping buildSuggestedMapping(DetectedStructure structure) {
        List<LevelConfig> levels = structure.getLevels().stream()
                .map(level -> {
                    LevelMapping suggestion = suggestMappingForLevel(
                            level.getSampleValues(), 
                            level.getDepth(), 
                            structure.getLevels().size()
                            );

                    return LevelConfig.builder()
                            .depth(level.getDepth())
                            .sampleValues(level.getSampleValues())
                            .mapping(suggestion)
                            .suggestedMapping(suggestion)
                            .confidence(0.7) // Default confidence
                            .build();
                })
                .collect(Collectors.toList());

        return FolderStructureMapping.builder()
                .levels(levels)
                .combineSeparator(" > ")
                .build();
    }

    /**
     * Extract title from filename
    */
    public String extractTitleFromFilename(String filename) {
        // Remove extension
        String title = filename.replaceAll("\\.[^/.]+$", "");

        // Replace common separators with spaces
        title = title.replaceAll("[-_]", " ");

        // Remove leading numbers/track numbers
        title = title.replaceAll("^(\\d+[\\s.\\-_]+)", "");

        // Clean up multiple spaces
        title = title.replaceAll("\\s+", " ").trim();

        return title;
    }

    /**
     * Apply mapping configuration to extract metadata from a file path
    */
    public MappedAudioFile applyMappingToFile(
            String relativePath, 
            String filename,
            FolderStructureMapping mapping, 
            Long sizeBytes) {

        String[] parts = relativePath.split("[/\\\\]");

        // Track accumulated values for append operations
        Map<String, List<String>> accumulated = new HashMap<>();
        accumulated.put("speaker", new ArrayList<>());
        accumulated.put("topic", new ArrayList<>());
        accumulated.put("language", new ArrayList<>());
        accumulated.put("series", new ArrayList<>());
        accumulated.put("title", new ArrayList<>());

        // Apply each level's mapping
        for (LevelConfig levelConfig : mapping.getLevels()) {
            if (levelConfig.getDepth() >= parts.length) continue;

            String value = parts[levelConfig.getDepth()];
            LevelMapping levelMapping = levelConfig.getMapping();

            if (levelMapping == null) continue;

            switch (levelMapping.getType()) {
                case "map_to_field":
                    accumulated.put(levelMapping.getField(), List.of(value));
                    break;
                case "append_to_field":
                    accumulated.get(levelMapping.getField()).add(value);
                    break;
                case "skip":
                case "filename":
                    // Do nothing
                    break;
            }
        }

        String separator = mapping.getCombineSeparator() != null 
                ? mapping.getCombineSeparator() 
                : " > ";

        return MappedAudioFile.builder()
                .originalPath(relativePath)
                .relativePath(relativePath)
                .filename(filename)
                .title(extractTitleFromFilename(filename))
                .speaker(joinValues(accumulated.get("speaker"), separator))
                .topic(joinValues(accumulated.get("topic"), separator))
                .language(accumulated.get("language").isEmpty() ? null : accumulated.get("language").get(0))
                .series(joinValues(accumulated.get("series"), separator))
                .sizeBytes(sizeBytes)
                .build();
    }

    private String joinValues(List<String> values, String separator) {
        if (values == null || values.isEmpty()){
            return null;
        } 
        return String.join(separator, values);
    }

    /**
     * Apply mapping to all files in the scanned directory
     */
    public List<MappedAudioFile> applyMappingToDirectory(
            String sourcePath, 
            FolderStructureMapping mapping) throws IOException {

        Path rootPath = Paths.get(sourcePath);
        List<MappedAudioFile> results = new ArrayList<>();

        Files.walkFileTree(rootPath, new SimpleFileVisitor<>() {
            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
                if (isAudioFile(file.getFileName().toString())) {
                    String relativePath = rootPath.relativize(file).toString();
                    String filename = file.getFileName().toString();
                    try {
                        long size = Files.size(file);
                        results.add(applyMappingToFile(relativePath, filename, mapping, size));
                    } catch (IOException e) {
                        log.warn("Could not get size for file: {}", file, e);
                        results.add(applyMappingToFile(relativePath, filename, mapping, null));
                    }
                }
                return FileVisitResult.CONTINUE;
            }
        });
        
        return results;
    }

    /**
     * Import a single file (kept for single-file endpoint).
     */
    public void importSingleFile(
            String sourcePath, MappedAudioFile mappedFile, UUID tenantId) throws IOException {

        Path sourceFile = Paths.get(sourcePath).resolve(mappedFile.getOriginalPath());

        if (!Files.exists(sourceFile)) {
            throw new IllegalArgumentException("Source file not found: " + sourceFile);
        }

        String fileHash = AudioService.computeFileHash(sourceFile);
        String storageKey = storageService.storeFileFromPath(sourceFile, tenantId);
        long durationSeconds = storageService.getAudioDuration(storageKey);

        audioService.createDraftWithFile(
                mappedFile.getTitle(), 
                mappedFile.getSeries(),
                mappedFile.getSpeaker(), 
                mappedFile.getTopic(),
                storageKey, mappedFile.getFilename(),
                mappedFile.getSizeBytes() != null ? mappedFile.getSizeBytes() : Files.size(sourceFile),
                getMimeType(mappedFile.getFilename()),
                durationSeconds, tenantId, fileHash
        );
        log.info("Imported file: {} as '{}'", mappedFile.getFilename(), mappedFile.getTitle());
    }

    @lombok.Data
    @lombok.Builder
    public static class BatchImportResult {
        private int totalFiles;
        private int successCount;
        private int duplicateCount;
        private int withinBatchDuplicateCount;
        private int dbDuplicateCount;
        private int errorCount;
        private List<String> duplicateFiles;
        private List<ImportError> errors;

        @lombok.Data
        @lombok.Builder
        public static class ImportError {
            private String filename;
            private String error;
        }
    }

    @Transactional
    public BatchImportResult importBatch(
            String sourcePath,
            List<MappedAudioFile> files,
            UUID tenantId) {

        log.info("Batch import started: {} files for tenant {}", files.size(), tenantId);

        List<String> duplicateFiles = new ArrayList<>();
        List<BatchImportResult.ImportError> errors = new ArrayList<>();
        int withinBatchDuplicateCount = 0;
        int successCount = 0;

        Map<String, MappedAudioFile> hashToFile = new LinkedHashMap<>();
        Map<String, Path> hashToPath = new LinkedHashMap<>();

        for (MappedAudioFile mappedFile : files) {
            try {
                Path sourceFile = Paths.get(sourcePath).resolve(mappedFile.getOriginalPath());
                if (!Files.exists(sourceFile)) {
                    errors.add(BatchImportResult.ImportError.builder()
                            .filename(mappedFile.getFilename())
                            .error("File not found: " + sourceFile).build());
                    continue;
                }

                String fileHash = AudioService.computeFileHash(sourceFile);

                if (hashToFile.containsKey(fileHash)) {
                    // CHECK 1: Within-batch duplicate
                    String originalFile = hashToFile.get(fileHash).getFilename();
                    duplicateFiles.add(mappedFile.getFilename()
                            + " (duplicate of " + originalFile + " in this upload)");
                    withinBatchDuplicateCount++;
                } else {
                    hashToFile.put(fileHash, mappedFile);
                    hashToPath.put(fileHash, sourceFile);
                }
            } catch (Exception e) {
                errors.add(BatchImportResult.ImportError.builder()
                        .filename(mappedFile.getFilename())
                        .error("Hash failed: " + e.getMessage()).build());
            }
        }

        log.info("Loop 1 done: {} unique hashes, {} within-batch duplicates, {} errors",
                hashToFile.size(), withinBatchDuplicateCount, errors.size());

        Set<String> existingHashes = Collections.emptySet();
        if (!hashToFile.isEmpty()) {
            existingHashes = audioRepository.findExistingHashes(hashToFile.keySet());
        }

        log.info("DB query done: {} of {} hashes already exist", existingHashes.size(), hashToFile.size());

        List<Audio> audioEntities = new ArrayList<>();
        int dbDuplicateCount = 0;

        for (Map.Entry<String, MappedAudioFile> entry : hashToFile.entrySet()) {
            String fileHash = entry.getKey();
            MappedAudioFile mappedFile = entry.getValue();

            // CHECK 2: Database duplicate
            if (existingHashes.contains(fileHash)) {
                duplicateFiles.add(mappedFile.getFilename() + " (already exists in library)");
                dbDuplicateCount++;
                continue;  // skip — don't copy file, don't build entity
            }

            // Passed BOTH checks → process this file
            Path sourceFile = hashToPath.get(fileHash);
            try {
                String storageKey = storageService.storeFileFromPath(sourceFile, tenantId);
                long durationSeconds = storageService.getAudioDuration(storageKey);
                long sizeBytes = mappedFile.getSizeBytes() != null
                        ? mappedFile.getSizeBytes() : Files.size(sourceFile);

                // Pre-set UUID → set URL before save → eliminates double save
                UUID audioId = UUID.randomUUID();
                Audio audio = new Audio();
                audio.setId(audioId);
                audio.setTenantId(tenantId);
                audio.setTitle(mappedFile.getTitle());
                audio.setDescription(mappedFile.getSeries());
                audio.setSpeaker(mappedFile.getSpeaker());
                audio.setTopic(mappedFile.getTopic());
                audio.setLanguage("en");
                audio.setDurationSeconds(durationSeconds);
                audio.setMimeType(getMimeType(mappedFile.getFilename()));
                audio.setSizeBytes(sizeBytes);
                audio.setStatus(Audio.Status.DRAFT);
                audio.setStorageKey(storageKey);
                audio.setOriginalFilename(mappedFile.getFilename());
                audio.setFileHash(fileHash);
                audio.setUrl("/api/v1/audio/" + audioId + "/stream");

                audioEntities.add(audio);
                successCount++;
            } catch (Exception e) {
                errors.add(BatchImportResult.ImportError.builder()
                        .filename(mappedFile.getFilename())
                        .error(e.getMessage()).build());
            }
        }

        log.info("Loop 2 done: {} entities built, {} DB duplicates, {} errors",
                audioEntities.size(), dbDuplicateCount, errors.size());

        if (!audioEntities.isEmpty()) {
            audioRepository.saveAll(audioEntities);
            log.info("Batch save done: {} records in 1 call", audioEntities.size());
        }

        BatchImportResult result = BatchImportResult.builder()
                .totalFiles(files.size())
                .successCount(successCount)
                .duplicateCount(withinBatchDuplicateCount + dbDuplicateCount)
                .withinBatchDuplicateCount(withinBatchDuplicateCount)
                .dbDuplicateCount(dbDuplicateCount)
                .errorCount(errors.size())
                .duplicateFiles(duplicateFiles)
                .errors(errors)
                .build();

        log.info("Batch import complete: {} success, {} duplicates ({} batch + {} DB), {} errors / {} total",
                result.getSuccessCount(), result.getDuplicateCount(),
                result.getWithinBatchDuplicateCount(), result.getDbDuplicateCount(),
                result.getErrorCount(), result.getTotalFiles());

        return result;
    }

    private String getMimeType(String filename) {
        String lower = filename.toLowerCase();
        if (lower.endsWith(".mp3")) return "audio/mpeg";
        if (lower.endsWith(".wav")) return "audio/wav";
        if (lower.endsWith(".ogg")) return "audio/ogg";
        if (lower.endsWith(".m4a")) return "audio/mp4";
        if (lower.endsWith(".flac")) return "audio/flac";
        if (lower.endsWith(".aac")) return "audio/aac";
        if (lower.endsWith(".wma")) return "audio/x-ms-wma";
        return "audio/mpeg";
    }
}