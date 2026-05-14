package com.audiolibrary.dto;

import com.audiolibrary.entity.Tenant;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class TenantResponse {
    private UUID id;
    private String name;
    private String subdomain;
    private String customDomain;
    private boolean active;
    private String subscriptionPlan;
    private LocalDateTime createdAt;

    public static TenantResponse fromEntity(Tenant tenant) {
        return TenantResponse.builder()
                .id(tenant.getId())
                .name(tenant.getName())
                .subdomain(tenant.getSubdomain())
                .customDomain(tenant.getCustomDomain())
                .active(tenant.isActive())
                .subscriptionPlan(tenant.getSubscriptionPlan())
                .createdAt(tenant.getCreatedAt())
                .build();
    }
}

