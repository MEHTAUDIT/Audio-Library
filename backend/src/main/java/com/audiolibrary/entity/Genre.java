package com.audiolibrary.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "genres")
@Getter
@Setter
public class Genre extends BaseEntity {

    private String name;

    @Column(name = "tenant_id")
    private UUID tenantId;
}


