package com.audiolibrary.controller;

import com.audiolibrary.config.TenantContext;
import com.audiolibrary.dto.PlaylistDtos;
import com.audiolibrary.entity.Audio;
import com.audiolibrary.entity.PlaylistShareLink;
import com.audiolibrary.entity.Tenant;
import com.audiolibrary.entity.User;
import com.audiolibrary.repository.PlaylistShareLinkRepository;
import com.audiolibrary.repository.TenantRepository;
import com.audiolibrary.repository.UserRepository;
import com.audiolibrary.service.AudioService;
import com.audiolibrary.service.PlaylistService;
import com.audiolibrary.service.StorageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1")
@Tag(name = "Playlists", description = "Playlist sharing and public playlist endpoints")
public class PlaylistController {

    private final PlaylistService playlistService;
    private final PlaylistShareLinkRepository playlistShareLinkRepository;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final AudioService audioService;
    private final StorageService storageService;

    @Operation(summary = "List my playlists")
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/playlists")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<PlaylistDtos.PlaylistResponse>> getMyPlaylists(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(playlistService.getUserPlaylistResponses(currentUserId(userDetails)));
    }

    @Operation(summary = "Get my playlist")
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/playlists/{playlistId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PlaylistDtos.PlaylistResponse> getMyPlaylist(
            @PathVariable UUID playlistId,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(playlistService.getOwnedPlaylistResponse(playlistId, currentUserId(userDetails)));
    }

    @Operation(summary = "Create playlist")
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/playlists")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PlaylistDtos.PlaylistResponse> createPlaylist(
            @Valid @RequestBody PlaylistDtos.PlaylistCreateRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = currentUser(userDetails);
        var playlist = playlistService.createPlaylist(
                user.getId(),
                user.getTenantId(),
                request.getName().trim(),
                request.getDescription(),
                request.getVisibility()
        );
        return ResponseEntity.ok(playlistService.getOwnedPlaylistResponse(playlist.getId(), user.getId()));
    }

    @Operation(summary = "Update playlist")
    @SecurityRequirement(name = "bearerAuth")
    @PutMapping("/playlists/{playlistId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PlaylistDtos.PlaylistResponse> updatePlaylist(
            @PathVariable UUID playlistId,
            @RequestBody PlaylistDtos.PlaylistUpdateRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        UUID userId = currentUserId(userDetails);
        if (!playlistService.isOwner(playlistId, userId)) {
            throw new IllegalArgumentException("Playlist not found: " + playlistId);
        }
        playlistService.updatePlaylist(playlistId, request.getName(), request.getDescription(), request.getVisibility());
        return ResponseEntity.ok(playlistService.getOwnedPlaylistResponse(playlistId, userId));
    }

    @Operation(summary = "Delete playlist")
    @SecurityRequirement(name = "bearerAuth")
    @DeleteMapping("/playlists/{playlistId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> deletePlaylist(
            @PathVariable UUID playlistId,
            @AuthenticationPrincipal UserDetails userDetails) {
        UUID userId = currentUserId(userDetails);
        if (!playlistService.isOwner(playlistId, userId)) {
            throw new IllegalArgumentException("Playlist not found: " + playlistId);
        }
        playlistService.deletePlaylist(playlistId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Add media to playlist")
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/playlists/{playlistId}/items")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PlaylistDtos.PlaylistResponse> addPlaylistItem(
            @PathVariable UUID playlistId,
            @RequestBody PlaylistDtos.PlaylistItemRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        UUID userId = currentUserId(userDetails);
        if (!playlistService.isOwner(playlistId, userId)) {
            throw new IllegalArgumentException("Playlist not found: " + playlistId);
        }
        playlistService.addAudioToPlaylist(playlistId, request.getAudioId(), request.getNote());
        return ResponseEntity.ok(playlistService.getOwnedPlaylistResponse(playlistId, userId));
    }

    @Operation(summary = "Remove media from playlist")
    @SecurityRequirement(name = "bearerAuth")
    @DeleteMapping("/playlists/{playlistId}/items/{audioId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PlaylistDtos.PlaylistResponse> removePlaylistItem(
            @PathVariable UUID playlistId,
            @PathVariable UUID audioId,
            @AuthenticationPrincipal UserDetails userDetails) {
        UUID userId = currentUserId(userDetails);
        if (!playlistService.isOwner(playlistId, userId)) {
            throw new IllegalArgumentException("Playlist not found: " + playlistId);
        }
        playlistService.removeAudioFromPlaylist(playlistId, audioId);
        return ResponseEntity.ok(playlistService.getOwnedPlaylistResponse(playlistId, userId));
    }

    @Operation(summary = "Create or fetch public share link", description = "Makes a playlist public and returns its share link.")
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/playlists/{playlistId}/share")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PlaylistDtos.PlaylistShareResponse> sharePlaylist(
            @PathVariable UUID playlistId,
            @AuthenticationPrincipal UserDetails userDetails,
            HttpServletRequest request) {
        return ResponseEntity.ok(playlistService.getOrCreateShareLink(
                playlistId,
                currentUserId(userDetails),
                frontendBaseUrl(request)
        ));
    }

    @Operation(summary = "Regenerate public share link", description = "Invalidates the old link and creates a fresh public link.")
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/playlists/{playlistId}/share/regenerate")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PlaylistDtos.PlaylistShareResponse> regenerateShareLink(
            @PathVariable UUID playlistId,
            @AuthenticationPrincipal UserDetails userDetails,
            HttpServletRequest request) {
        return ResponseEntity.ok(playlistService.regenerateShareLink(
                playlistId,
                currentUserId(userDetails),
                frontendBaseUrl(request)
        ));
    }

    @Operation(summary = "Revoke public share link", description = "Makes a playlist private and invalidates its public link.")
    @SecurityRequirement(name = "bearerAuth")
    @DeleteMapping("/playlists/{playlistId}/share")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> revokeShareLink(
            @PathVariable UUID playlistId,
            @AuthenticationPrincipal UserDetails userDetails) {
        playlistService.revokeShareLink(playlistId, currentUserId(userDetails));
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Open public playlist", description = "Fetch a public playlist by share token. No authentication required.")
    @GetMapping("/public/playlists/{shareToken}")
    @PreAuthorize("permitAll()")
    public ResponseEntity<PlaylistDtos.PublicPlaylistResponse> getPublicPlaylist(@PathVariable String shareToken) {
        return ResponseEntity.ok(withTenantFromShareToken(shareToken,
                link -> playlistService.getPublicPlaylist(link.getPlaylistId())));
    }

    @Operation(summary = "Stream public playlist item", description = "Stream a published media item through a playlist share token.")
    @GetMapping("/public/playlists/{shareToken}/audio/{audioId}/stream")
    @PreAuthorize("permitAll()")
    public ResponseEntity<?> streamPublicPlaylistItem(
            @PathVariable String shareToken,
            @PathVariable UUID audioId) {
        return withTenantFromShareToken(shareToken, link -> streamOrDownloadPublicPlaylistItem(link, audioId, false));
    }

    @Operation(summary = "Download public playlist item", description = "Download a published media item through a playlist share token.")
    @GetMapping("/public/playlists/{shareToken}/audio/{audioId}/download")
    @PreAuthorize("permitAll()")
    public ResponseEntity<?> downloadPublicPlaylistItem(
            @PathVariable String shareToken,
            @PathVariable UUID audioId) {
        return withTenantFromShareToken(shareToken, link -> streamOrDownloadPublicPlaylistItem(link, audioId, true));
    }

    private UUID currentUserId(UserDetails userDetails) {
        return currentUser(userDetails).getId();
    }

    private User currentUser(UserDetails userDetails) {
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    private String frontendBaseUrl(HttpServletRequest request) {
        String origin = request.getHeader("Origin");
        if (origin != null && !origin.isBlank()) {
            return origin;
        }

        String forwardedProto = request.getHeader("X-Forwarded-Proto");
        String forwardedHost = request.getHeader("X-Forwarded-Host");
        if (forwardedProto != null && forwardedHost != null) {
            return forwardedProto + "://" + forwardedHost;
        }

        return request.getScheme() + "://" + request.getServerName() + ":" + request.getServerPort();
    }

    private <T> T withTenantFromShareToken(String shareToken, java.util.function.Function<PlaylistShareLink, T> action) {
        PlaylistShareLink link = playlistShareLinkRepository.findByTokenAndActiveTrue(shareToken)
                .orElseThrow(() -> new IllegalArgumentException("Playlist link not found"));

        Tenant tenant = tenantRepository.findById(link.getTenantId())
                .orElseThrow(() -> new IllegalArgumentException("Tenant not found"));

        if (!tenant.isActive()) {
            throw new IllegalArgumentException("Playlist link not found");
        }

        String previousTenant = TenantContext.getCurrentTenant();
        try {
            TenantContext.setCurrentTenant(link.getTenantSchema());
            return action.apply(link);
        } finally {
            if (previousTenant != null) {
                TenantContext.setCurrentTenant(previousTenant);
            } else {
                TenantContext.clear();
            }
        }
    }

    private ResponseEntity<?> streamOrDownloadPublicPlaylistItem(PlaylistShareLink link, UUID audioId, boolean download) {
        PlaylistDtos.PublicPlaylistResponse playlist = playlistService.getPublicPlaylist(link.getPlaylistId());
        boolean containsAudio = playlist.getItems().stream().anyMatch(item -> audioId.equals(item.getId()));
        if (!containsAudio) {
            return ResponseEntity.notFound().build();
        }

        Audio audio = audioService.getAudioEntity(audioId);
        if (audio.getStatus() != Audio.Status.PUBLISHED || audio.getStorageKey() == null) {
            return ResponseEntity.notFound().build();
        }

        if (storageService.isS3Storage()) {
            String presignedUrl = storageService.getFileUrl(audio.getStorageKey());
            return ResponseEntity.status(302)
                    .header(HttpHeaders.LOCATION, presignedUrl)
                    .build();
        }

        Resource resource = storageService.loadFileAsResource(audio.getStorageKey());
        String contentType = audio.getMimeType() != null ? audio.getMimeType() : "application/octet-stream";
        String filename = audio.getOriginalFilename() != null ? audio.getOriginalFilename() : "media_file";
        String disposition = download ? "attachment" : "inline";

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition + "; filename=\"" + filename + "\"")
                .body(resource);
    }
}
