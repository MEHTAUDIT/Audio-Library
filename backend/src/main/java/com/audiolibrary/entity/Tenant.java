package com.audiolibrary.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "tenants", schema = "PUBLIC")
@Getter
@Setter
public class Tenant extends BaseEntity {

    private String name;

    private String subdomain;

    private String customDomain;

    /**
     * Physical schema name used for this tenant's isolated data.
     * Example: tenant_<uuid-without-dashes>
     */
    private String schemaName;

    private boolean active = true;

    // Billing/Subscription info can be added here
    private String subscriptionPlan;
}

