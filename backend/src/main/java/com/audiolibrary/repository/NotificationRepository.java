package com.audiolibrary.repository;

import com.audiolibrary.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    /**
     * Find all notifications for a user, most recent first.
     */
    @Query("SELECT n FROM Notification n WHERE n.user.id = :userId ORDER BY n.createdAt DESC")
    Page<Notification> findAllByUserId(@Param("userId") UUID userId, Pageable pageable);

    /**
     * Find unread notifications for a user.
     */
    @Query("SELECT n FROM Notification n WHERE n.user.id = :userId AND n.readAt IS NULL ORDER BY n.createdAt DESC")
    List<Notification> findUnreadByUserId(@Param("userId") UUID userId);

    /**
     * Count unread notifications.
     */
    @Query("SELECT COUNT(n) FROM Notification n WHERE n.user.id = :userId AND n.readAt IS NULL")
    long countUnreadByUserId(@Param("userId") UUID userId);

    /**
     * Mark all as read for user.
     */
    @Modifying
    @Query("UPDATE Notification n SET n.readAt = CURRENT_TIMESTAMP WHERE n.user.id = :userId AND n.readAt IS NULL")
    void markAllAsReadByUserId(@Param("userId") UUID userId);

    /**
     * Mark single notification as read.
     */
    @Modifying
    @Query("UPDATE Notification n SET n.readAt = CURRENT_TIMESTAMP WHERE n.id = :notificationId AND n.readAt IS NULL")
    void markAsRead(@Param("notificationId") UUID notificationId);

    /**
     * Delete old read notifications (cleanup).
     */
    @Modifying
    @Query("DELETE FROM Notification n WHERE n.user.id = :userId AND n.readAt IS NOT NULL " +
           "AND n.createdAt < :before")
    void deleteOldReadNotifications(@Param("userId") UUID userId, @Param("before") java.time.LocalDateTime before);
}





