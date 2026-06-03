package com.audiolibrary.dto;

import com.audiolibrary.entity.Playlist;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public class PlaylistDtos {

    @Data
    public static class PlaylistCreateRequest {
        @NotBlank
        private String name;
        private String description;
        private Playlist.Visibility visibility;
    }

    @Data
    public static class PlaylistUpdateRequest {
        private String name;
        private String description;
        private Playlist.Visibility visibility;
    }

    @Data
    public static class PlaylistItemRequest {
        @NotNull
        private UUID audioId;
        private String note;
        private Integer position;
    }

    @Data
    @Builder
    public static class PlaylistShareResponse {
        private UUID playlistId;
        private String visibility;
        private String shareToken;
        private String shareUrl;
    }

    @Data
    @Builder
    public static class PlaylistResponse {
        private UUID id;
        private String name;
        private String description;
        private String visibility;
        private String shareToken;
        private long itemCount;
        private long totalDurationSeconds;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        private List<AudioResponse> items;
    }

    @Data
    @Builder
    public static class PublicPlaylistResponse {
        private UUID id;
        private String name;
        private String description;
        private String visibility;
        private String shareToken;
        private long itemCount;
        private long totalDurationSeconds;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        private List<AudioResponse> items;
    }
}
