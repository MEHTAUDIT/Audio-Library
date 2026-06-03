package com.audiolibrary.service;

import com.audiolibrary.dto.BulkImportDtos.FolderStructureMapping;
import com.audiolibrary.dto.BulkImportDtos.LevelConfig;
import com.audiolibrary.dto.BulkImportDtos.LevelMapping;
import com.audiolibrary.dto.BulkImportDtos.MappedAudioFile;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class BulkImportServiceTest {

    private final BulkImportService service = new BulkImportService(
            null, null, null, null, null, null, null, null, null, null
    );

    @Test
    void appliesFolderLevelsToLinkedMetadataFields() {
        FolderStructureMapping mapping = FolderStructureMapping.builder()
                .combineSeparator(" > ")
                .levels(List.of(
                        level(0, "speaker"),
                        level(1, "genres"),
                        level(2, "tags"),
                        level(3, "language")
                ))
                .build();

        MappedAudioFile mapped = service.applyMappingToFile(
                "Nirav Pokiya/Educational/Featured/en/01_intro.mp3",
                "01_intro.mp3",
                mapping,
                1024L
        );

        assertEquals("intro", mapped.getTitle());
        assertEquals("Nirav Pokiya", mapped.getSpeaker());
        assertEquals(List.of("Educational"), mapped.getGenres());
        assertEquals(List.of("Featured"), mapped.getTags());
        assertEquals("en", mapped.getLanguage());
    }

    private LevelConfig level(int depth, String field) {
        return LevelConfig.builder()
                .depth(depth)
                .mapping(LevelMapping.builder().type("map_to_field").field(field).build())
                .build();
    }
}
