package com.audiolibrary.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "playlist_share_links", schema = "PUBLIC")
@Getter
@Setter
public class PlaylistShareLink extends BaseEntity {

    @Column(nullable = false, unique = true)
    private String token;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "tenant_schema", nullable = false)
    private String tenantSchema;

    @Column(name = "playlist_id", nullable = false)
    private UUID playlistId;

    @Column(nullable = false)
    private boolean active = true;
}
