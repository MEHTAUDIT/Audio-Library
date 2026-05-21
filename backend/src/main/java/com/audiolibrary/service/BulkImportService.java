package com.audiolibrary.service;

import com.audiolibrary.dto.BulkImportDtos.*;
import com.audiolibrary.entity.*;
import com.audiolibrary.repository.*;
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

@Service
@RequiredArgsConstructor
@Slf4j
public class BulkImportService {

    private final AudioService audioService;
    private final StorageService storageService;
    private final AudioRepository audioRepository;

    private final SpeakerRepository speakerRepository;
    private final TagRepository tagRepository;
    private final GenreRepository genreRepository;
    private final AudioSpeakerJoinRepository audioSpeakerJoinRepository;
    private final AudioTagJoinRepository audioTagJoinRepository;
    private final AudioGenreJoinRepository audioGenreJoinRepository;

    private static final Set<String> MEDIA_EXTENSIONS = Set.of(
            ".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac", ".wma",
            ".mp4", ".mkv", ".avi", ".mov", ".webm", ".wmv", ".m4v"
    );

    private static final List<Pattern> SPEAKER_PATTERNS = List.of(
            Pattern.compile("^(Rabbi|Rav|Dr\\.?|Rev\\.?|Pastor|Imam|Sheikh|Harav|Reb|Mr\\.?|Mrs\\.?|Ms\\.?)\\s", Pattern.CASE_INSENSITIVE),
            Pattern.compile("^[A-Z][a-z]+\\s+[A-Z][a-z]+$"),
            Pattern.compile("^[A-Z][a-z]+\\s+[A-Z]\\.\\s+[A-Z][a-z]+$")
    );

    private static final Set<String> LANGUAGE_CODES = Set.of(
            "en", "he", "yi", "es", "fr", "de", "english", "hebrew", "yiddish", "spanish", "french", "german"
    );

    private static final Set<String> SKIP_PATTERNS = Set.of(
            "audio", "video", "videos", "files", "uploads", "library", "content", "media" 
    );

    public boolean isAudioFile(String filename) {
        String lower = filename.toLowerCase();
        return MEDIA_EXTENSIONS.stream().anyMatch(lower::endsWith);
    }

    public ScanResponse scanDirectory(String sourcePath) throws IOException {
        Path rootPath = Paths.get(sourcePath);
        if (!Files.exists(rootPath)) throw new IllegalArgumentException("Path does not exist: " + sourcePath);
        if (!Files.isDirectory(rootPath)) throw new IllegalArgumentException("Path is not a directory: " + sourcePath);

        log.info("Scanning directory: {}", sourcePath);
        List<Path> audioFiles = new ArrayList<>();
        Files.walkFileTree(rootPath, new SimpleFileVisitor<>() {
            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
                if (isAudioFile(file.getFileName().toString())) audioFiles.add(file);
                return FileVisitResult.CONTINUE;
            }
        });

        log.info("Found {} audio files", audioFiles.size());
        if (audioFiles.isEmpty()) {
            return ScanResponse.builder()
                    .structure(DetectedStructure.builder().rootPath(sourcePath)
                            .levels(Collections.emptyList()).totalFiles(0).sampleFiles(Collections.emptyList()).build())
                    .suggestedMapping(FolderStructureMapping.builder()
                            .levels(Collections.emptyList()).combineSeparator(" > ").build())
                    .build();
        }

        DetectedStructure structure = analyzeStructure(rootPath, audioFiles);
        FolderStructureMapping suggestedMapping = buildSuggestedMapping(structure);
        return ScanResponse.builder().structure(structure).suggestedMapping(suggestedMapping).build();
    }

    private DetectedStructure analyzeStructure(Path rootPath, List<Path> audioFiles) {
        List<List<String>> pathParts = audioFiles.stream().map(f -> {
            Path relative = rootPath.relativize(f);
            List<String> parts = new ArrayList<>();
            for (Path part : relative) parts.add(part.toString());
            return parts;
        }).collect(Collectors.toList());

        int maxDepth = pathParts.stream().mapToInt(List::size).max().orElse(0);
        Map<Integer, Set<String>> levelMap = new HashMap<>();
        for (List<String> parts : pathParts) {
            for (int i = 0; i < parts.size() - 1; i++)
                levelMap.computeIfAbsent(i, k -> new LinkedHashSet<>()).add(parts.get(i));
        }

        List<DetectedLevel> levels = new ArrayList<>();
        for (int i = 0; i < maxDepth - 1; i++) {
            Set<String> values = levelMap.get(i);
            if (values != null)
                levels.add(DetectedLevel.builder().depth(i)
                        .sampleValues(values.stream().limit(10).collect(Collectors.toList()))
                        .totalFolders(values.size()).build());
        }

        return DetectedStructure.builder().rootPath(rootPath.toString()).levels(levels)
                .totalFiles(audioFiles.size())
                .sampleFiles(audioFiles.stream().limit(10).map(f -> rootPath.relativize(f).toString()).collect(Collectors.toList()))
                .build();
    }

    private LevelMapping suggestMappingForLevel(List<String> sampleValues, int depth, int totalLevels) {
        long speakerMatches = sampleValues.stream()
                .filter(v -> SPEAKER_PATTERNS.stream().anyMatch(p -> p.matcher(v).find())).count();
        if (speakerMatches >= sampleValues.size() * 0.5)
            return LevelMapping.builder().type("map_to_field").field("speaker").build();
        if (sampleValues.stream().allMatch(v -> v.matches("^(19|20)\\d{2}$")))
            return LevelMapping.builder().type("skip").build();
        if (sampleValues.stream().allMatch(v -> LANGUAGE_CODES.contains(v.toLowerCase())))
            return LevelMapping.builder().type("map_to_field").field("language").build();
        if (sampleValues.size() == 1 && SKIP_PATTERNS.stream().anyMatch(p -> sampleValues.get(0).toLowerCase().contains(p)))
            return LevelMapping.builder().type("skip").build();
        if (depth == 0) return LevelMapping.builder().type("map_to_field").field("speaker").build();
        return LevelMapping.builder().type("map_to_field").field("topic").build();
    }

    private FolderStructureMapping buildSuggestedMapping(DetectedStructure structure) {
        List<LevelConfig> levels = structure.getLevels().stream().map(level -> {
            LevelMapping suggestion = suggestMappingForLevel(level.getSampleValues(), level.getDepth(), structure.getLevels().size());
            return LevelConfig.builder().depth(level.getDepth()).sampleValues(level.getSampleValues())
                    .mapping(suggestion).suggestedMapping(suggestion).confidence(0.7).build();
        }).collect(Collectors.toList());
        return FolderStructureMapping.builder().levels(levels).combineSeparator(" > ").build();
    }

    public String extractTitleFromFilename(String filename) {
        String title = filename.replaceAll("\\.[^/.]+$", "");
        title = title.replaceAll("[-_]", " ");
        title = title.replaceAll("^(\\d+[\\s.\\-_]+)", "");
        return title.replaceAll("\\s+", " ").trim();
    }

    public MappedAudioFile applyMappingToFile(String relativePath, String filename,
                                               FolderStructureMapping mapping, Long sizeBytes) {
        String[] parts = relativePath.split("[/\\\\]");
        Map<String, List<String>> accumulated = new HashMap<>();
        accumulated.put("speaker", new ArrayList<>());
        accumulated.put("topic", new ArrayList<>());
        accumulated.put("language", new ArrayList<>());
        accumulated.put("series", new ArrayList<>());
        accumulated.put("title", new ArrayList<>());

        for (LevelConfig levelConfig : mapping.getLevels()) {
            if (levelConfig.getDepth() >= parts.length) continue;
            String value = parts[levelConfig.getDepth()];
            LevelMapping levelMapping = levelConfig.getMapping();
            if (levelMapping == null) continue;
            switch (levelMapping.getType()) {
                case "map_to_field": accumulated.put(levelMapping.getField(), List.of(value)); break;
                case "append_to_field": accumulated.get(levelMapping.getField()).add(value); break;
                case "skip": case "filename": break;
            }
        }

        String separator = mapping.getCombineSeparator() != null ? mapping.getCombineSeparator() : " > ";
        return MappedAudioFile.builder()
                .originalPath(relativePath).relativePath(relativePath).filename(filename)
                .title(extractTitleFromFilename(filename))
                .speaker(joinValues(accumulated.get("speaker"), separator))
                .topic(joinValues(accumulated.get("topic"), separator))
                .language(accumulated.get("language").isEmpty() ? null : accumulated.get("language").get(0))
                .series(joinValues(accumulated.get("series"), separator))
                .sizeBytes(sizeBytes).build();
    }

    private String joinValues(List<String> values, String separator) {
        if (values == null || values.isEmpty()) return null;
        return String.join(separator, values);
    }

    public List<MappedAudioFile> applyMappingToDirectory(String sourcePath, FolderStructureMapping mapping) throws IOException {
        Path rootPath = Paths.get(sourcePath);
        List<MappedAudioFile> results = new ArrayList<>();
        Files.walkFileTree(rootPath, new SimpleFileVisitor<>() {
            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
                if (isAudioFile(file.getFileName().toString())) {
                    String relativePath = rootPath.relativize(file).toString();
                    String filename = file.getFileName().toString();
                    try {
                        results.add(applyMappingToFile(relativePath, filename, mapping, Files.size(file)));
                    } catch (IOException e) {
                        results.add(applyMappingToFile(relativePath, filename, mapping, null));
                    }
                }
                return FileVisitResult.CONTINUE;
            }
        });
        return results;
    }

    public void importSingleFile(String sourcePath, MappedAudioFile mappedFile, UUID tenantId) throws IOException {
        Path sourceFile = Paths.get(sourcePath).resolve(mappedFile.getOriginalPath());
        if (!Files.exists(sourceFile)) throw new IllegalArgumentException("Source file not found: " + sourceFile);

        String fileHash = AudioService.computeFileHash(sourceFile);
        String storageKey = storageService.storeFileFromPath(sourceFile, tenantId);
        long durationSeconds = storageService.getAudioDuration(storageKey);

        audioService.createDraftWithFile(
                mappedFile.getTitle(), mappedFile.getSeries(), mappedFile.getSpeaker(), mappedFile.getTopic(),
                storageKey, mappedFile.getFilename(),
                mappedFile.getSizeBytes() != null ? mappedFile.getSizeBytes() : Files.size(sourceFile),
                getMimeType(mappedFile.getFilename()), durationSeconds, tenantId, fileHash
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

        private int speakersLinked;
        private int tagsLinked;
        private int genresLinked;

        @lombok.Data
        @lombok.Builder
        public static class ImportError {
            private String filename;
            private String error;
        }
    }

    @Transactional
    public BatchImportResult importBatch(String sourcePath, List<MappedAudioFile> files, UUID tenantId) {
        log.info("Batch import started: {} files for tenant {}", files.size(), tenantId);

        List<String> duplicateFiles = new ArrayList<>();
        List<BatchImportResult.ImportError> errors = new ArrayList<>();
        int withinBatchDuplicateCount = 0;
        int successCount = 0;

        // ── Loop 1: Compute hashes + within-batch duplicate check (Map) ──
        Map<String, MappedAudioFile> hashToFile = new LinkedHashMap<>();
        Map<String, Path> hashToPath = new LinkedHashMap<>();

        for (MappedAudioFile mappedFile : files) {
            try {
                Path sourceFile = Paths.get(sourcePath).resolve(mappedFile.getOriginalPath());
                if (!Files.exists(sourceFile)) {
                    errors.add(BatchImportResult.ImportError.builder()
                            .filename(mappedFile.getFilename()).error("File not found: " + sourceFile).build());
                    continue;
                }
                String fileHash = AudioService.computeFileHash(sourceFile);

                if (hashToFile.containsKey(fileHash)) {
                    String originalFile = hashToFile.get(fileHash).getFilename();
                    duplicateFiles.add(mappedFile.getFilename() + " (duplicate of " + originalFile + " in this upload)");
                    withinBatchDuplicateCount++;
                } else {
                    hashToFile.put(fileHash, mappedFile);
                    hashToPath.put(fileHash, sourceFile);
                }
            } catch (Exception e) {
                errors.add(BatchImportResult.ImportError.builder()
                        .filename(mappedFile.getFilename()).error("Hash failed: " + e.getMessage()).build());
            }
        }

        // ── 1 DB query: Batch duplicate check against database (Set) ──
        Set<String> existingHashes = Collections.emptySet();
        if (!hashToFile.isEmpty()) {
            existingHashes = audioRepository.findExistingHashes(hashToFile.keySet());
        }

        // ── Loop 2 (merged): Check DB Set + copy file + build entity ──
        List<Audio> audioEntities = new ArrayList<>();
        // Track which audio gets which speaker/tags/genres for linking after save
        Map<UUID, MappedAudioFile> audioIdToMappedFile = new LinkedHashMap<>();
        int dbDuplicateCount = 0;

        for (Map.Entry<String, MappedAudioFile> entry : hashToFile.entrySet()) {
            String fileHash = entry.getKey();
            MappedAudioFile mappedFile = entry.getValue();

            if (existingHashes.contains(fileHash)) {
                duplicateFiles.add(mappedFile.getFilename() + " (already exists in library)");
                dbDuplicateCount++;
                continue;
            }

            Path sourceFile = hashToPath.get(fileHash);
            try {
                String storageKey = storageService.storeFileFromPath(sourceFile, tenantId);
                long durationSeconds = storageService.getAudioDuration(storageKey);
                long sizeBytes = mappedFile.getSizeBytes() != null ? mappedFile.getSizeBytes() : Files.size(sourceFile);

                UUID audioId = UUID.randomUUID();
                Audio audio = new Audio();
                audio.setId(audioId);
                audio.setTenantId(tenantId);
                audio.setTitle(mappedFile.getTitle());
                audio.setDescription(mappedFile.getSeries());
                audio.setSpeaker(mappedFile.getSpeaker());     // legacy string field
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
                audioIdToMappedFile.put(audioId, mappedFile);
                successCount++;
            } catch (Exception e) {
                errors.add(BatchImportResult.ImportError.builder()
                        .filename(mappedFile.getFilename()).error(e.getMessage()).build());
            }
        }

        // ── Batch save all Audio entities ──
        if (!audioEntities.isEmpty()) {
            audioRepository.saveAll(audioEntities);
            log.info("Batch save done: {} audio records", audioEntities.size());
        }

        int speakersLinked = 0;
        int tagsLinked = 0;
        int genresLinked = 0;

        Map<String, Speaker> speakerCache = new HashMap<>();
        Map<String, Tag> tagCache = new HashMap<>();
        Map<String, Genre> genreCache = new HashMap<>();

        List<AudioSpeakerJoin> speakerJoins = new ArrayList<>();
        List<AudioTagJoin> tagJoins = new ArrayList<>();
        List<AudioGenreJoin> genreJoins = new ArrayList<>();

        for (Audio audio : audioEntities) {
            MappedAudioFile mappedFile = audioIdToMappedFile.get(audio.getId());
            if (mappedFile == null) continue;

            // ── Link Speaker ──
            if (mappedFile.getSpeaker() != null && !mappedFile.getSpeaker().isBlank()) {
                String speakerName = mappedFile.getSpeaker().trim();
                Speaker speaker = speakerCache.computeIfAbsent(speakerName, name -> {
                    // Find existing or create new Speaker entity
                    return speakerRepository.findByTenantIdAndNameIgnoreCaseAndDeletedAtIsNull(tenantId, name)
                            .orElseGet(() -> {
                                Speaker newSpeaker = new Speaker();
                                newSpeaker.setName(name);
                                newSpeaker.setTenantId(tenantId);
                                log.info("Created new speaker: '{}'", name);
                                return speakerRepository.save(newSpeaker);
                            });
                });

                AudioSpeakerJoin join = new AudioSpeakerJoin();
                join.setId(new AudioSpeakerJoinId(audio.getId(), speaker.getId()));
                join.setAudio(audio);
                join.setSpeaker(speaker);
                speakerJoins.add(join);
                speakersLinked++;
            }

            // ── Link Tags ──
            if (mappedFile.getTags() != null && !mappedFile.getTags().isEmpty()) {
                for (String tagName : mappedFile.getTags()) {
                    if (tagName == null || tagName.isBlank()) continue;
                    String trimmedTag = tagName.trim();

                    Tag tag = tagCache.computeIfAbsent(trimmedTag, name -> {
                        return tagRepository.findByTenantIdAndNameIgnoreCaseAndDeletedAtIsNull(tenantId, name)
                                .orElseGet(() -> {
                                    Tag newTag = new Tag();
                                    newTag.setName(name);
                                    // Generate slug from name: "Sunday Sermons" → "sunday-sermons"
                                    newTag.setSlug(name.toLowerCase().replaceAll("[^a-z0-9]+", "-")
                                            .replaceAll("^-|-$", ""));
                                    newTag.setTenantId(tenantId);
                                    newTag.setUsageCount(0L);
                                    log.info("Created new tag: '{}'", name);
                                    return tagRepository.save(newTag);
                                });
                    });

                    AudioTagJoin join = new AudioTagJoin();
                    join.setId(new AudioTagJoinId(audio.getId(), tag.getId()));
                    join.setAudio(audio);
                    join.setTag(tag);
                    tagJoins.add(join);
                    tagsLinked++;
                }
            }

            // ── Link Genres ──
            if (mappedFile.getGenres() != null && !mappedFile.getGenres().isEmpty()) {
                for (String genreName : mappedFile.getGenres()) {
                    if (genreName == null || genreName.isBlank()) continue;
                    String trimmedGenre = genreName.trim();

                    Genre genre = genreCache.computeIfAbsent(trimmedGenre, name -> {
                        return genreRepository.findByTenantIdAndNameIgnoreCase(tenantId, name)
                                .orElseGet(() -> {
                                    Genre newGenre = new Genre();
                                    newGenre.setName(name);
                                    newGenre.setTenantId(tenantId);
                                    log.info("Created new genre: '{}'", name);
                                    return genreRepository.save(newGenre);
                                });
                    });

                    AudioGenreJoin join = new AudioGenreJoin();
                    join.setId(new AudioGenreJoinId(audio.getId(), genre.getId()));
                    join.setAudio(audio);
                    join.setGenre(genre);
                    genreJoins.add(join);
                    genresLinked++;
                }
            }
        }

        // ── Batch save all join entities ──
        if (!speakerJoins.isEmpty()) {
            audioSpeakerJoinRepository.saveAll(speakerJoins);
            log.info("Linked {} audio-speaker relationships ({} unique speakers)",
                    speakerJoins.size(), speakerCache.size());
        }
        if (!tagJoins.isEmpty()) {
            audioTagJoinRepository.saveAll(tagJoins);
            log.info("Linked {} audio-tag relationships ({} unique tags)",
                    tagJoins.size(), tagCache.size());
        }
        if (!genreJoins.isEmpty()) {
            audioGenreJoinRepository.saveAll(genreJoins);
            log.info("Linked {} audio-genre relationships ({} unique genres)",
                    genreJoins.size(), genreCache.size());
        }

        // ── Update tag usage counts ──
        for (Tag tag : tagCache.values()) {
            long count = tagJoins.stream().filter(j -> j.getTag().getId().equals(tag.getId())).count();
            if (count > 0) {
                tag.setUsageCount((tag.getUsageCount() != null ? tag.getUsageCount() : 0L) + count);
                tagRepository.save(tag);
            }
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
                .speakersLinked(speakersLinked)
                .tagsLinked(tagsLinked)
                .genresLinked(genresLinked)
                .build();

        log.info("Batch import complete: {} success, {} duplicates, {} errors, linked: {} speakers, {} tags, {} genres",
                result.getSuccessCount(), result.getDuplicateCount(), result.getErrorCount(),
                result.getSpeakersLinked(), result.getTagsLinked(), result.getGenresLinked());

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