package com.audiolibrary.controller;

import com.audiolibrary.dto.AudioResponse;
import com.audiolibrary.entity.User;
import com.audiolibrary.entity.UserPreferences;
import com.audiolibrary.repository.UserRepository;
import com.audiolibrary.service.UserLibraryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/user/library")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "User Library", description = "User library features: favorites, queue, history, preferences")
@SecurityRequirement(name = "bearerAuth")
public class UserLibraryController {

    private final UserLibraryService userLibraryService;
    private final UserRepository userRepository;

    private UUID getCurrentUserId(UserDetails userDetails) {
        User user = userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }

    // ============ FAVORITE AUDIO ============

    @Operation(summary = "Favorite an audio", description = "Add audio to user's favorites")
    @PostMapping("/favorites/audio/{audioId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> favoriteAudio(
            @PathVariable UUID audioId,
            @AuthenticationPrincipal UserDetails userDetails) {
        UUID userId = getCurrentUserId(userDetails);
        userLibraryService.favoriteAudio(userId, audioId);
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "Unfavorite an audio", description = "Remove audio from user's favorites")
    @DeleteMapping("/favorites/audio/{audioId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> unfavoriteAudio(
            @PathVariable UUID audioId,
            @AuthenticationPrincipal UserDetails userDetails) {
        UUID userId = getCurrentUserId(userDetails);
        userLibraryService.unfavoriteAudio(userId, audioId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Check if audio is favorited", description = "Check if user has favorited an audio")
    @GetMapping("/favorites/audio/{audioId}/status")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Boolean>> isAudioFavorited(
            @PathVariable UUID audioId,
            @AuthenticationPrincipal UserDetails userDetails) {
        UUID userId = getCurrentUserId(userDetails);
        boolean favorited = userLibraryService.isAudioFavorited(userId, audioId);
        return ResponseEntity.ok(Map.of("favorited", favorited));
    }

    @Operation(summary = "Get favorite audios", description = "Get all user's favorite audio files")
    @GetMapping("/favorites/audio")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<AudioResponse>> getFavoriteAudios(
            @AuthenticationPrincipal UserDetails userDetails) {
        UUID userId = getCurrentUserId(userDetails);
        return ResponseEntity.ok(userLibraryService.getFavoriteAudios(userId));
    }

    // ============ FAVORITE SPEAKER ============

    @Operation(summary = "Favorite a speaker", description = "Add speaker to user's favorites")
    @PostMapping("/favorites/speaker/{speakerId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> favoriteSpeaker(
            @PathVariable UUID speakerId,
            @AuthenticationPrincipal UserDetails userDetails) {
        UUID userId = getCurrentUserId(userDetails);
        userLibraryService.favoriteSpeaker(userId, speakerId);
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "Unfavorite a speaker", description = "Remove speaker from user's favorites")
    @DeleteMapping("/favorites/speaker/{speakerId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> unfavoriteSpeaker(
            @PathVariable UUID speakerId,
            @AuthenticationPrincipal UserDetails userDetails) {
        UUID userId = getCurrentUserId(userDetails);
        userLibraryService.unfavoriteSpeaker(userId, speakerId);
        return ResponseEntity.noContent().build();
    }

    // ============ PLAYBACK QUEUE (Listen-to List) ============

    @Operation(summary = "Add to queue", description = "Add audio to listen-later queue")
    @PostMapping("/queue/{audioId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> addToQueue(
            @PathVariable UUID audioId,
            @AuthenticationPrincipal UserDetails userDetails) {
        UUID userId = getCurrentUserId(userDetails);
        userLibraryService.addToQueue(userId, audioId);
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "Remove from queue", description = "Remove audio from queue")
    @DeleteMapping("/queue/{audioId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> removeFromQueue(
            @PathVariable UUID audioId,
            @AuthenticationPrincipal UserDetails userDetails) {
        UUID userId = getCurrentUserId(userDetails);
        userLibraryService.removeFromQueue(userId, audioId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Get queue", description = "Get user's listen-later queue")
    @GetMapping("/queue")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<AudioResponse>> getQueue(
            @AuthenticationPrincipal UserDetails userDetails) {
        UUID userId = getCurrentUserId(userDetails);
        return ResponseEntity.ok(userLibraryService.getQueue(userId));
    }

    @Operation(summary = "Check if in queue", description = "Check if audio is in user's queue")
    @GetMapping("/queue/{audioId}/status")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Boolean>> isInQueue(
            @PathVariable UUID audioId,
            @AuthenticationPrincipal UserDetails userDetails) {
        UUID userId = getCurrentUserId(userDetails);
        boolean inQueue = userLibraryService.isInQueue(userId, audioId);
        return ResponseEntity.ok(Map.of("inQueue", inQueue));
    }

    // ============ PLAYBACK POSITION ============

    @Operation(summary = "Update playback position", description = "Save current playback position for resume")
    @PostMapping("/position/{audioId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> updatePlaybackPosition(
            @PathVariable UUID audioId,
            @RequestBody Map<String, Long> body,
            @AuthenticationPrincipal UserDetails userDetails) {
        UUID userId = getCurrentUserId(userDetails);
        Long position = body.get("position");
        if (position != null) {
            userLibraryService.updatePlaybackPosition(userId, audioId, position);
        }
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "Get playback position", description = "Get saved playback position for resume")
    @GetMapping("/position/{audioId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Long>> getPlaybackPosition(
            @PathVariable UUID audioId,
            @AuthenticationPrincipal UserDetails userDetails) {
        UUID userId = getCurrentUserId(userDetails);
        Long position = userLibraryService.getPlaybackPosition(userId, audioId);
        return ResponseEntity.ok(Map.of("position", position));
    }

    // ============ HISTORY ============

    @Operation(summary = "Get listening history", description = "Get user's recent listening history")
    @GetMapping("/history")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<AudioResponse>> getHistory(
            @RequestParam(defaultValue = "20") int limit,
            @AuthenticationPrincipal UserDetails userDetails) {
        UUID userId = getCurrentUserId(userDetails);
        return ResponseEntity.ok(userLibraryService.getHistory(userId, limit));
    }

    // ============ PREFERENCES ============

    @Operation(summary = "Get preferences", description = "Get user's playback preferences")
    @GetMapping("/preferences")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<UserPreferences> getPreferences(
            @AuthenticationPrincipal UserDetails userDetails) {
        UUID userId = getCurrentUserId(userDetails);
        return ResponseEntity.ok(userLibraryService.getOrCreatePreferences(userId));
    }

    @Operation(summary = "Update playback speed", description = "Update preferred playback speed")
    @PutMapping("/preferences/speed")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<UserPreferences> updatePlaybackSpeed(
            @RequestBody Map<String, Double> body,
            @AuthenticationPrincipal UserDetails userDetails) {
        UUID userId = getCurrentUserId(userDetails);
        Double speed = body.get("speed");
        if (speed != null) {
            return ResponseEntity.ok(userLibraryService.updatePlaybackSpeed(userId, speed));
        }
        return ResponseEntity.badRequest().build();
    }
}
