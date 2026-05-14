package com.audiolibrary.service;

import com.audiolibrary.entity.Audio;
import com.audiolibrary.entity.Playlist;
import com.audiolibrary.entity.PlaylistItem;
import com.audiolibrary.entity.User;
import com.audiolibrary.repository.AudioRepository;
import com.audiolibrary.repository.PlaylistItemRepository;
import com.audiolibrary.repository.PlaylistRepository;
import com.audiolibrary.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
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
        
        return playlistRepository.save(playlist);
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
        
        return playlistRepository.save(playlist);
    }

    /**
     * Soft delete a playlist.
     */
    public void deletePlaylist(UUID playlistId) {
        Playlist playlist = playlistRepository.findActiveById(playlistId)
                .orElseThrow(() -> new IllegalArgumentException("Playlist not found: " + playlistId));
        playlist.setDeletedAt(LocalDateTime.now());
        playlistRepository.save(playlist);
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
}





