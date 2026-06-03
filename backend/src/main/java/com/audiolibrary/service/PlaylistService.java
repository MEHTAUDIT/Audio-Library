package com.audiolibrary.service;

import com.audiolibrary.config.TenantContext;
import com.audiolibrary.dto.AudioResponse;
import com.audiolibrary.dto.PlaylistDtos;
import com.audiolibrary.entity.Audio;
import com.audiolibrary.entity.Playlist;
import com.audiolibrary.entity.PlaylistItem;
import com.audiolibrary.entity.PlaylistShareLink;
import com.audiolibrary.entity.User;
import com.audiolibrary.repository.AudioRepository;
import com.audiolibrary.repository.PlaylistItemRepository;
import com.audiolibrary.repository.PlaylistRepository;
import com.audiolibrary.repository.PlaylistShareLinkRepository;
import com.audiolibrary.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class PlaylistService {

    private final PlaylistRepository playlistRepository;
    private final PlaylistItemRepository playlistItemRepository;
    private final UserRepository userRepository;
    private final AudioRepository audioRepository;
    private final PlaylistShareLinkRepository playlistShareLinkRepository;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    /**
     * Create a new playlist.
     */
    public Playlist createPlaylist(UUID userId, UUID tenantId, String name, String description, Playlist.Visibility visibility) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        
        Playlist playlist = new Playlist();
        playlist.setUser(user);
        playlist.setTenantId(tenantId);
        playlist.setName(name);
        playlist.setDescription(description);
        playlist.setVisibility(visibility != null ? visibility : Playlist.Visibility.PRIVATE);
        
        Playlist saved = playlistRepository.save(playlist);
        if (saved.getVisibility() == Playlist.Visibility.PUBLIC) {
            ensureShareLink(saved, false);
        }
        return saved;
    }

    /**
     * Get all playlists for a user.
     */
    @Transactional(readOnly = true)
    public List<Playlist> getUserPlaylists(UUID userId) {
        return playlistRepository.findAllActiveByUserId(userId);
    }

    /**
     * Get playlists with pagination.
     */
    @Transactional(readOnly = true)
    public Page<Playlist> getUserPlaylists(UUID userId, Pageable pageable) {
        return playlistRepository.findAllActiveByUserId(userId, pageable);
    }

    /**
     * Find playlist by ID.
     */
    @Transactional(readOnly = true)
    public Optional<Playlist> findById(UUID playlistId) {
        return playlistRepository.findActiveById(playlistId);
    }

    /**
     * Get public playlists for discovery.
     */
    @Transactional(readOnly = true)
    public Page<Playlist> getPublicPlaylists(UUID tenantId, Pageable pageable) {
        return playlistRepository.findPublicPlaylists(tenantId, pageable);
    }

    /**
     * Update playlist details.
     */
    public Playlist updatePlaylist(UUID playlistId, String name, String description, Playlist.Visibility visibility) {
        Playlist playlist = playlistRepository.findActiveById(playlistId)
                .orElseThrow(() -> new IllegalArgumentException("Playlist not found: " + playlistId));
        
        if (name != null) {
            playlist.setName(name);
        }
        if (description != null) {
            playlist.setDescription(description);
        }
        if (visibility != null) {
            playlist.setVisibility(visibility);
        }

        Playlist saved = playlistRepository.save(playlist);
        if (saved.getVisibility() == Playlist.Visibility.PUBLIC) {
            ensureShareLink(saved, false);
        } else {
            revokeShareLink(saved);
        }

        return saved;
    }

    /**
     * Soft delete a playlist.
     */
    public void deletePlaylist(UUID playlistId) {
        Playlist playlist = playlistRepository.findActiveById(playlistId)
                .orElseThrow(() -> new IllegalArgumentException("Playlist not found: " + playlistId));
        playlist.setDeletedAt(LocalDateTime.now());
        playlistRepository.save(playlist);
        revokeShareLink(playlist);
    }

    /**
     * Add audio to playlist.
     */
    public PlaylistItem addAudioToPlaylist(UUID playlistId, UUID audioId, String note) {
        Playlist playlist = playlistRepository.findActiveById(playlistId)
                .orElseThrow(() -> new IllegalArgumentException("Playlist not found: " + playlistId));
        
        Audio audio = audioRepository.findById(audioId)
                .orElseThrow(() -> new IllegalArgumentException("Audio not found: " + audioId));
        
        // Check if already in playlist
        if (playlistItemRepository.existsByPlaylistIdAndAudioId(playlistId, audioId)) {
            throw new IllegalStateException("Audio already in playlist");
        }
        
        int nextPosition = playlistItemRepository.findMaxPositionByPlaylistId(playlistId) + 1;
        
        PlaylistItem item = new PlaylistItem();
        item.setPlaylist(playlist);
        item.setAudio(audio);
        item.setPosition(nextPosition);
        item.setNote(note);
        
        return playlistItemRepository.save(item);
    }

    /**
     * Add audio at specific position.
     */
    public PlaylistItem addAudioAtPosition(UUID playlistId, UUID audioId, int position, String note) {
        Playlist playlist = playlistRepository.findActiveById(playlistId)
                .orElseThrow(() -> new IllegalArgumentException("Playlist not found: " + playlistId));
        
        Audio audio = audioRepository.findById(audioId)
                .orElseThrow(() -> new IllegalArgumentException("Audio not found: " + audioId));
        
        if (playlistItemRepository.existsByPlaylistIdAndAudioId(playlistId, audioId)) {
            throw new IllegalStateException("Audio already in playlist");
        }
        
        // Shift existing items down
        playlistItemRepository.shiftPositionsDown(playlistId, position);
        
        PlaylistItem item = new PlaylistItem();
        item.setPlaylist(playlist);
        item.setAudio(audio);
        item.setPosition(position);
        item.setNote(note);
        
        return playlistItemRepository.save(item);
    }

    /**
     * Remove audio from playlist.
     */
    public void removeAudioFromPlaylist(UUID playlistId, UUID audioId) {
        PlaylistItem item = playlistItemRepository.findByPlaylistIdAndAudioId(playlistId, audioId)
                .orElseThrow(() -> new IllegalArgumentException("Audio not in playlist"));
        
        int position = item.getPosition();
        playlistItemRepository.delete(item);
        
        // Shift remaining items up
        playlistItemRepository.shiftPositionsUp(playlistId, position);
    }

    /**
     * Reorder item in playlist.
     */
    public void reorderPlaylistItem(UUID playlistId, UUID audioId, int newPosition) {
        PlaylistItem item = playlistItemRepository.findByPlaylistIdAndAudioId(playlistId, audioId)
                .orElseThrow(() -> new IllegalArgumentException("Audio not in playlist"));
        
        int currentPosition = item.getPosition();
        if (currentPosition == newPosition) {
            return;
        }
        
        if (newPosition < currentPosition) {
            // Moving up: shift items between newPosition and currentPosition down
            playlistItemRepository.shiftPositionsDown(playlistId, newPosition);
        } else {
            // Moving down: shift items between currentPosition and newPosition up
            playlistItemRepository.shiftPositionsUp(playlistId, currentPosition);
        }
        
        item.setPosition(newPosition);
        playlistItemRepository.save(item);
    }

    /**
     * Get all items in a playlist.
     */
    @Transactional(readOnly = true)
    public List<PlaylistItem> getPlaylistItems(UUID playlistId) {
        return playlistItemRepository.findAllByPlaylistIdOrderByPosition(playlistId);
    }

    /**
     * Get count of items in playlist.
     */
    @Transactional(readOnly = true)
    public long getPlaylistItemCount(UUID playlistId) {
        return playlistItemRepository.countByPlaylistId(playlistId);
    }

    /**
     * Clear all items from playlist.
     */
    public void clearPlaylist(UUID playlistId) {
        playlistItemRepository.deleteAllByPlaylistId(playlistId);
    }

    /**
     * Check if user owns playlist.
     */
    @Transactional(readOnly = true)
    public boolean isOwner(UUID playlistId, UUID userId) {
        return playlistRepository.findActiveById(playlistId)
                .map(p -> p.getUser().getId().equals(userId))
                .orElse(false);
    }

    @Transactional(readOnly = true)
    public List<PlaylistDtos.PlaylistResponse> getUserPlaylistResponses(UUID userId) {
        return playlistRepository.findAllActiveByUserId(userId).stream()
                .map(this::toPlaylistResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public PlaylistDtos.PlaylistResponse getOwnedPlaylistResponse(UUID playlistId, UUID userId) {
        return toPlaylistResponse(requireOwnedPlaylist(playlistId, userId));
    }

    public PlaylistDtos.PlaylistShareResponse getOrCreateShareLink(UUID playlistId, UUID userId, String baseUrl) {
        Playlist playlist = requireOwnedPlaylist(playlistId, userId);
        playlist.setVisibility(Playlist.Visibility.PUBLIC);
        Playlist saved = playlistRepository.save(playlist);
        PlaylistShareLink link = ensureShareLink(saved, false);
        return toShareResponse(saved, link, baseUrl);
    }

    public PlaylistDtos.PlaylistShareResponse regenerateShareLink(UUID playlistId, UUID userId, String baseUrl) {
        Playlist playlist = requireOwnedPlaylist(playlistId, userId);
        playlist.setVisibility(Playlist.Visibility.PUBLIC);
        Playlist saved = playlistRepository.save(playlist);
        PlaylistShareLink link = ensureShareLink(saved, true);
        return toShareResponse(saved, link, baseUrl);
    }

    public void revokeShareLink(UUID playlistId, UUID userId) {
        Playlist playlist = requireOwnedPlaylist(playlistId, userId);
        playlist.setVisibility(Playlist.Visibility.PRIVATE);
        playlistRepository.save(playlist);
        revokeShareLink(playlist);
    }

    @Transactional(readOnly = true)
    public PlaylistDtos.PublicPlaylistResponse getPublicPlaylist(UUID playlistId) {
        Playlist playlist = playlistRepository.findActiveById(playlistId)
                .orElseThrow(() -> new IllegalArgumentException("Playlist not found"));

        if (playlist.getVisibility() != Playlist.Visibility.PUBLIC) {
            throw new IllegalArgumentException("Playlist is not public");
        }

        List<AudioResponse> items = playlistItemRepository.findPublishedByPlaylistIdOrderByPosition(playlistId).stream()
                .map(PlaylistItem::getAudio)
                .map(AudioResponse::fromEntity)
                .toList();

        long totalDurationSeconds = items.stream()
                .map(AudioResponse::getDurationSeconds)
                .filter(duration -> duration != null && duration > 0)
                .mapToLong(Long::longValue)
                .sum();

        return PlaylistDtos.PublicPlaylistResponse.builder()
                .id(playlist.getId())
                .name(playlist.getName())
                .description(playlist.getDescription())
                .visibility(playlist.getVisibility().name())
                .shareToken(playlist.getShareToken())
                .itemCount(items.size())
                .totalDurationSeconds(totalDurationSeconds)
                .createdAt(playlist.getCreatedAt())
                .updatedAt(playlist.getUpdatedAt())
                .items(items)
                .build();
    }

    private Playlist requireOwnedPlaylist(UUID playlistId, UUID userId) {
        Playlist playlist = playlistRepository.findActiveById(playlistId)
                .orElseThrow(() -> new IllegalArgumentException("Playlist not found: " + playlistId));

        if (!playlist.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("Playlist not found: " + playlistId);
        }

        return playlist;
    }

    private PlaylistShareLink ensureShareLink(Playlist playlist, boolean regenerate) {
        if (regenerate) {
            revokeShareLink(playlist);
            playlist.setShareToken(null);
        }

        Optional<PlaylistShareLink> existingLink = playlistShareLinkRepository.findByPlaylistIdAndActiveTrue(playlist.getId());
        if (existingLink.isPresent() && playlist.getShareToken() != null) {
            return existingLink.get();
        }

        String token = generateToken();
        playlist.setShareToken(token);
        playlistRepository.save(playlist);

        PlaylistShareLink link = new PlaylistShareLink();
        link.setToken(token);
        link.setTenantId(playlist.getTenantId());
        link.setTenantSchema(TenantContext.getCurrentTenant());
        link.setPlaylistId(playlist.getId());
        link.setActive(true);
        return playlistShareLinkRepository.save(link);
    }

    private void revokeShareLink(Playlist playlist) {
        playlistShareLinkRepository.findByPlaylistIdAndActiveTrue(playlist.getId())
                .ifPresent(link -> {
                    link.setActive(false);
                    playlistShareLinkRepository.save(link);
                });
        playlist.setShareToken(null);
        playlistRepository.save(playlist);
    }

    private String generateToken() {
        byte[] tokenBytes = new byte[24];
        String token;
        do {
            SECURE_RANDOM.nextBytes(tokenBytes);
            token = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);
        } while (playlistShareLinkRepository.findByTokenAndActiveTrue(token).isPresent());
        return token;
    }

    private PlaylistDtos.PlaylistShareResponse toShareResponse(Playlist playlist, PlaylistShareLink link, String baseUrl) {
        String normalizedBaseUrl = baseUrl != null && !baseUrl.isBlank()
                ? baseUrl.replaceAll("/+$", "")
                : "";

        return PlaylistDtos.PlaylistShareResponse.builder()
                .playlistId(playlist.getId())
                .visibility(playlist.getVisibility().name())
                .shareToken(link.getToken())
                .shareUrl(normalizedBaseUrl + "/playlist/" + link.getToken())
                .build();
    }

    private PlaylistDtos.PlaylistResponse toPlaylistResponse(Playlist playlist) {
        List<AudioResponse> items = playlistItemRepository.findAllByPlaylistIdOrderByPosition(playlist.getId()).stream()
                .map(PlaylistItem::getAudio)
                .map(AudioResponse::fromEntity)
                .toList();

        long totalDurationSeconds = items.stream()
                .map(AudioResponse::getDurationSeconds)
                .filter(duration -> duration != null && duration > 0)
                .mapToLong(Long::longValue)
                .sum();

        return PlaylistDtos.PlaylistResponse.builder()
                .id(playlist.getId())
                .name(playlist.getName())
                .description(playlist.getDescription())
                .visibility(playlist.getVisibility().name())
                .shareToken(playlist.getShareToken())
                .itemCount(items.size())
                .totalDurationSeconds(totalDurationSeconds)
                .createdAt(playlist.getCreatedAt())
                .updatedAt(playlist.getUpdatedAt())
                .items(items)
                .build();
    }
}





