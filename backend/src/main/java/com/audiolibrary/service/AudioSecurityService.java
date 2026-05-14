package com.audiolibrary.service;

import com.audiolibrary.entity.Audio;
import com.audiolibrary.repository.AudioRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Security service for audio-related authorization checks.
 * Used with @PreAuthorize annotations for fine-grained access control.
 * 
 * Example usage in controller:
 * @PreAuthorize("@audioSecurity.canView(#id, authentication)")
 */
@Service("audioSecurity")
@RequiredArgsConstructor
@Slf4j
public class AudioSecurityService {

    private final AudioRepository audioRepository;

    /**
     * Check if the current user can view an audio file.
     * Published audio is viewable by anyone (including anonymous users).
     * Non-published audio requires ADMIN role.
     */
    public boolean canView(UUID audioId, Authentication authentication) {
        if (audioId == null) {
            return false;
        }

        Audio audio = audioRepository.findById(audioId).orElse(null);
        if (audio == null) {
            log.debug("Audio not found: {}", audioId);
            return false;
        }

        // Published audio is public
        if (audio.getStatus() == Audio.Status.PUBLISHED) {
            log.debug("Audio {} is published, allowing access", audioId);
            return true;
        }

        // Non-published audio requires admin role
        boolean isAdmin = isAdmin(authentication);
        log.debug("Audio {} is {}, user is admin: {}", audioId, audio.getStatus(), isAdmin);
        return isAdmin;
    }

    /**
     * Check if the current user can stream an audio file.
     * Same rules as canView - published audio is streamable by anyone.
     */
    public boolean canStream(UUID audioId, Authentication authentication) {
        return canView(audioId, authentication);
    }

    /**
     * Check if the current user can download an audio file.
     * Same rules as canView - published audio is downloadable by anyone.
     */
    public boolean canDownload(UUID audioId, Authentication authentication) {
        return canView(audioId, authentication);
    }

    /**
     * Check if the current user can modify an audio file (update, delete, publish, etc.).
     * Requires ADMIN role.
     */
    public boolean canModify(UUID audioId, Authentication authentication) {
        return isAdmin(authentication);
    }

    /**
     * Check if the current user has ADMIN role.
     */
    public boolean isAdmin(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return false;
        }
        
        return authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN") || 
                              a.getAuthority().equals("ROLE_OWNER"));
    }

    /**
     * Check if the user is authenticated (not anonymous).
     */
    public boolean isAuthenticated(Authentication authentication) {
        return authentication != null && 
               authentication.isAuthenticated() && 
               !authentication.getPrincipal().equals("anonymousUser");
    }
}

