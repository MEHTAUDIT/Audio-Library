package com.audiolibrary.service;

import com.audiolibrary.entity.Notification;
import com.audiolibrary.entity.User;
import com.audiolibrary.repository.NotificationRepository;
import com.audiolibrary.repository.UserRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    // Notification types
    public static final String TYPE_NEW_AUDIO_FROM_SPEAKER = "NEW_AUDIO_FROM_SPEAKER";
    public static final String TYPE_PLAYLIST_SHARED = "PLAYLIST_SHARED";
    public static final String TYPE_SYSTEM = "SYSTEM";
    public static final String TYPE_RECOMMENDATION = "RECOMMENDATION";

    /**
     * Create a notification.
     */
    public Notification createNotification(UUID userId, UUID tenantId, String type, String title, String body, Map<String, Object> payload) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        
        Notification notification = new Notification();
        notification.setUser(user);
        notification.setTenantId(tenantId);
        notification.setType(type);
        notification.setTitle(title);
        notification.setBody(body);
        
        if (payload != null) {
            try {
                notification.setPayloadJson(objectMapper.writeValueAsString(payload));
            } catch (JsonProcessingException e) {
                log.warn("Failed to serialize notification payload", e);
            }
        }
        
        return notificationRepository.save(notification);
    }

    /**
     * Create notification for new audio from followed speaker.
     */
    public Notification notifyNewAudioFromSpeaker(UUID userId, UUID tenantId, UUID audioId, UUID speakerId, String audioTitle, String speakerName) {
        String title = "New audio from " + speakerName;
        String body = speakerName + " published: " + audioTitle;
        
        Map<String, Object> payload = Map.of(
                "audioId", audioId.toString(),
                "speakerId", speakerId.toString(),
                "action", "OPEN_AUDIO"
        );
        
        return createNotification(userId, tenantId, TYPE_NEW_AUDIO_FROM_SPEAKER, title, body, payload);
    }

    /**
     * Get all notifications for a user.
     */
    @Transactional(readOnly = true)
    public Page<Notification> getUserNotifications(UUID userId, Pageable pageable) {
        return notificationRepository.findAllByUserId(userId, pageable);
    }

    /**
     * Get unread notifications.
     */
    @Transactional(readOnly = true)
    public List<Notification> getUnreadNotifications(UUID userId) {
        return notificationRepository.findUnreadByUserId(userId);
    }

    /**
     * Count unread notifications.
     */
    @Transactional(readOnly = true)
    public long countUnread(UUID userId) {
        return notificationRepository.countUnreadByUserId(userId);
    }

    /**
     * Mark notification as read.
     */
    public void markAsRead(UUID notificationId) {
        notificationRepository.markAsRead(notificationId);
    }

    /**
     * Mark all notifications as read.
     */
    public void markAllAsRead(UUID userId) {
        notificationRepository.markAllAsReadByUserId(userId);
    }

    /**
     * Delete old read notifications (cleanup).
     */
    public void cleanupOldNotifications(UUID userId, int daysOld) {
        LocalDateTime before = LocalDateTime.now().minusDays(daysOld);
        notificationRepository.deleteOldReadNotifications(userId, before);
    }

    /**
     * Get notification by ID.
     */
    @Transactional(readOnly = true)
    public Optional<Notification> findById(UUID notificationId) {
        return notificationRepository.findById(notificationId);
    }

    /**
     * Delete a notification.
     */
    public void deleteNotification(UUID notificationId) {
        notificationRepository.deleteById(notificationId);
    }

    /**
     * Broadcast notification to multiple users.
     */
    public void broadcastNotification(List<UUID> userIds, UUID tenantId, String type, String title, String body, Map<String, Object> payload) {
        for (UUID userId : userIds) {
            try {
                createNotification(userId, tenantId, type, title, body, payload);
            } catch (Exception e) {
                log.error("Failed to create notification for user {}", userId, e);
            }
        }
    }
}





