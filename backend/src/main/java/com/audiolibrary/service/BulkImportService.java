package com.audiolibrary.service;

import com.audiolibrary.dto.BulkImportDtos.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

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

    /**
     * Check if a file is an audio file based on extension
     */
    public boolean isAudioFile(String filename) {
        String lower = filename.toLowerCase();
        return AUDIO_EXTENSIONS.stream().anyMatch(lower::endsWith);
    }

    /**
     * Scan a directory and analyze its structure
     */
    public ScanResponse scanDirectory(String sourcePath) throws IOException {
        Path rootPath = Paths.get(sourcePath);
        
        if (!Files.exists(rootPath)) {
            throw new IllegalArgumentException("Path does not exist: " + sourcePath);
        }
        
        if (!Files.isDirectory(rootPath)) {
            throw new IllegalArgumentException("Path is not a directory: " + sourcePath);
        }

        log.info("Scanning directory: {}", sourcePath);

        // Collect all audio files
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

        // Analyze structure
        DetectedStructure structure = analyzeStructure(rootPath, audioFiles);
        
        // Build suggested mapping
        FolderStructureMapping suggestedMapping = buildSuggestedMapping(structure);

        return ScanResponse.builder()
                .structure(structure)
                .suggestedMapping(suggestedMapping)
                .build();
    }

    /**
     * Analyze the folder structure from collected audio files
     */
    private DetectedStructure analyzeStructure(Path rootPath, List<Path> audioFiles) {
        // Get relative paths
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

        // Find maximum depth
        int maxDepth = pathParts.stream()
                .mapToInt(List::size)
                .max()
                .orElse(0);

        // Collect unique values at each level (excluding filename level)
        Map<Integer, Set<String>> levelMap = new HashMap<>();
        for (List<String> parts : pathParts) {
            for (int i = 0; i < parts.size() - 1; i++) {
                levelMap.computeIfAbsent(i, k -> new LinkedHashSet<>()).add(parts.get(i));
            }
        }

        // Build levels
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

        // Get sample file paths
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
        if (values == null || values.isEmpty()) {
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
                        MappedAudioFile mapped = applyMappingToFile(
                                relativePath, filename, mapping, size);
                        results.add(mapped);
                    } catch (IOException e) {
                        log.warn("Could not get size for file: {}", file, e);
                        MappedAudioFile mapped = applyMappingToFile(
                                relativePath, filename, mapping, null);
                        results.add(mapped);
                    }
                }
                return FileVisitResult.CONTINUE;
            }
        });

        return results;
    }

    /**
     * Import a single file from a server path
     */
    public void importSingleFile(
            String sourcePath,
            MappedAudioFile mappedFile,
            UUID tenantId) throws IOException {
        
        Path sourceFile = Paths.get(sourcePath).resolve(mappedFile.getOriginalPath());
        
        if (!Files.exists(sourceFile)) {
            throw new IllegalArgumentException("Source file not found: " + sourceFile);
        }

        // Copy file to storage
        String storageKey = storageService.storeFileFromPath(sourceFile, tenantId);
        
        // Get audio duration
        long durationSeconds = storageService.getAudioDuration(storageKey);
        
        // Create audio record
        audioService.createDraftWithFile(
                mappedFile.getTitle(),
                mappedFile.getSeries(), // description
                mappedFile.getSpeaker(),
                mappedFile.getTopic(),
                storageKey,
                mappedFile.getFilename(),
                mappedFile.getSizeBytes() != null ? mappedFile.getSizeBytes() : Files.size(sourceFile),
                getMimeType(mappedFile.getFilename()),
                durationSeconds,
                tenantId
        );

        log.info("Imported file: {} as '{}'", mappedFile.getFilename(), mappedFile.getTitle());
    }

    /**
     * Get MIME type from filename
     */
    private String getMimeType(String filename) {
        String lower = filename.toLowerCase();
        if (lower.endsWith(".mp3")) return "audio/mpeg";
        if (lower.endsWith(".wav")) return "audio/wav";
        if (lower.endsWith(".ogg")) return "audio/ogg";
        if (lower.endsWith(".m4a")) return "audio/mp4";
        if (lower.endsWith(".flac")) return "audio/flac";
        if (lower.endsWith(".aac")) return "audio/aac";
        if (lower.endsWith(".wma")) return "audio/x-ms-wma";
        return "audio/mpeg"; // default
    }
}

