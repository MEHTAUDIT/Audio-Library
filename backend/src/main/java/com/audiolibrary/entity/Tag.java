package com.audiolibrary.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "tags")
@Getter
@Setter
public class Tag extends BaseEntity {

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String slug;

    private String description;

    /**
     * Hex color code for UI display (e.g., "#FF5733")
     */
    private String color;

    /**
     * Cached count of how many audio files use this tag.
     * Updated periodically or on tag assignment changes.
     */
    @Column(name = "usage_count")
    private Long usageCount = 0L;

    @Column(name = "tenant_id")
    private UUID tenantId;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    /**
     * Utility method to generate a URL-safe slug from a name.
     */
    public static String generateSlug(String name) {
        if (name == null) return "";
        return name.toLowerCase()
                .replaceAll("[^a-z0-9\\s-]", "")
                .replaceAll("\\s+", "-")
                .replaceAll("-+", "-")
                .replaceAll("^-|-$", "");
    }
}

