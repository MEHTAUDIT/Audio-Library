package com.audiolibrary.service;

import com.audiolibrary.entity.User;
import com.audiolibrary.entity.UserPreferences;
import com.audiolibrary.repository.UserPreferencesRepository;
import com.audiolibrary.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class UserPreferencesService {

    private final UserPreferencesRepository preferencesRepository;
    private final UserRepository userRepository;

    /**
     * Get user preferences, creating defaults if not exists.
     */
    public UserPreferences getOrCreatePreferences(UUID userId) {
        return preferencesRepository.findById(userId)
                .orElseGet(() -> createDefaultPreferences(userId));
    }

    /**
     * Get user preferences if exists.
     */
    @Transactional(readOnly = true)
    public Optional<UserPreferences> getPreferences(UUID userId) {
        return preferencesRepository.findById(userId);
    }

    /**
     * Create default preferences for a user.
     */
    public UserPreferences createDefaultPreferences(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        
        UserPreferences prefs = new UserPreferences();
        prefs.setUser(user);
        prefs.setPreferredPlaybackSpeed(BigDecimal.ONE);
        prefs.setAutoPlayNext(true);
        prefs.setEmailNotifications(true);
        prefs.setPushNotifications(true);
        prefs.setPreferredAudioLength(UserPreferences.AudioLength.ANY);
        prefs.setTheme(UserPreferences.Theme.SYSTEM);
        
        return preferencesRepository.save(prefs);
    }

    /**
     * Update playback speed preference.
     */
    public UserPreferences updatePlaybackSpeed(UUID userId, BigDecimal speed) {
        UserPreferences prefs = getOrCreatePreferences(userId);
        
        // Validate speed (0.5x to 3x)
        if (speed.compareTo(new BigDecimal("0.5")) < 0 || speed.compareTo(new BigDecimal("3.0")) > 0) {
            throw new IllegalArgumentException("Playback speed must be between 0.5 and 3.0");
        }
        
        prefs.setPreferredPlaybackSpeed(speed);
        return preferencesRepository.save(prefs);
    }

    /**
     * Update auto-play preference.
     */
    public UserPreferences updateAutoPlayNext(UUID userId, boolean autoPlay) {
        UserPreferences prefs = getOrCreatePreferences(userId);
        prefs.setAutoPlayNext(autoPlay);
        return preferencesRepository.save(prefs);
    }

    /**
     * Update notification preferences.
     */
    public UserPreferences updateNotificationPreferences(UUID userId, Boolean email, Boolean push) {
        UserPreferences prefs = getOrCreatePreferences(userId);
        
        if (email != null) {
            prefs.setEmailNotifications(email);
        }
        if (push != null) {
            prefs.setPushNotifications(push);
        }
        
        return preferencesRepository.save(prefs);
    }

    /**
     * Update preferred language.
     */
    public UserPreferences updatePreferredLanguage(UUID userId, String language) {
        UserPreferences prefs = getOrCreatePreferences(userId);
        prefs.setPreferredLanguage(language);
        return preferencesRepository.save(prefs);
    }

    /**
     * Update preferred audio length.
     */
    public UserPreferences updatePreferredAudioLength(UUID userId, UserPreferences.AudioLength length) {
        UserPreferences prefs = getOrCreatePreferences(userId);
        prefs.setPreferredAudioLength(length);
        return preferencesRepository.save(prefs);
    }

    /**
     * Update theme.
     */
    public UserPreferences updateTheme(UUID userId, UserPreferences.Theme theme) {
        UserPreferences prefs = getOrCreatePreferences(userId);
        prefs.setTheme(theme);
        return preferencesRepository.save(prefs);
    }

    /**
     * Update all preferences at once.
     */
    public UserPreferences updateAllPreferences(
            UUID userId,
            BigDecimal playbackSpeed,
            Boolean autoPlayNext,
            Boolean emailNotifications,
            Boolean pushNotifications,
            String preferredLanguage,
            UserPreferences.AudioLength preferredAudioLength,
            UserPreferences.Theme theme) {
        
        UserPreferences prefs = getOrCreatePreferences(userId);
        
        if (playbackSpeed != null) {
            if (playbackSpeed.compareTo(new BigDecimal("0.5")) < 0 || playbackSpeed.compareTo(new BigDecimal("3.0")) > 0) {
                throw new IllegalArgumentException("Playback speed must be between 0.5 and 3.0");
            }
            prefs.setPreferredPlaybackSpeed(playbackSpeed);
        }
        if (autoPlayNext != null) {
            prefs.setAutoPlayNext(autoPlayNext);
        }
        if (emailNotifications != null) {
            prefs.setEmailNotifications(emailNotifications);
        }
        if (pushNotifications != null) {
            prefs.setPushNotifications(pushNotifications);
        }
        if (preferredLanguage != null) {
            prefs.setPreferredLanguage(preferredLanguage);
        }
        if (preferredAudioLength != null) {
            prefs.setPreferredAudioLength(preferredAudioLength);
        }
        if (theme != null) {
            prefs.setTheme(theme);
        }
        
        return preferencesRepository.save(prefs);
    }
}





