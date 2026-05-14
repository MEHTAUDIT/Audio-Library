package com.audiolibrary.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "speakers")
@Getter
@Setter
public class Speaker extends BaseEntity {

    private String name;

    private String bio;

    @Column(name = "avatar_url")
    private String avatarUrl;

    @Column(name = "website_url")
    private String websiteUrl;

    @Column(name = "tenant_id")
    private UUID tenantId;

    // P1: Soft delete
    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    /**
     * Check if this speaker is soft-deleted.
     */
    public boolean isDeleted() {
        return deletedAt != null;
    }

    /**
     * Soft delete this speaker.
     */
    public void softDelete() {
        this.deletedAt = LocalDateTime.now();
    }

    /**
     * Restore a soft-deleted speaker.
     */
    public void restore() {
        this.deletedAt = null;
    }
}


