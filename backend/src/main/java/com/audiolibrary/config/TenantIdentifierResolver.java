package com.audiolibrary.config;

import org.hibernate.context.spi.CurrentTenantIdentifierResolver;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
public class TenantIdentifierResolver implements CurrentTenantIdentifierResolver {

    private final Environment environment;

    public TenantIdentifierResolver(Environment environment) {
        this.environment = environment;
    }

    @Override
    public String resolveCurrentTenantIdentifier() {
        String tenantId = TenantContext.getCurrentTenant();
        if (tenantId != null) {
            return tenantId;
        }
        // Default schema differs by DB: H2 uses PUBLIC, Postgres uses public.
        // We key off the local profile (H2 in-memory).
        return environment.matchesProfiles("local") ? "PUBLIC" : "public";
    }

    @Override
    public boolean validateExistingCurrentSessions() {
        return true;
    }
}

