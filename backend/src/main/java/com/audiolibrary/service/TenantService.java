package com.audiolibrary.service;

import com.audiolibrary.config.FlywayConfig;
import com.audiolibrary.dto.TenantRegistrationRequest;
import com.audiolibrary.entity.Tenant;
import com.audiolibrary.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class TenantService {

    private final TenantRepository tenantRepository;
    private final FlywayConfig flywayConfig;
    private final TenantUserProvisioningService tenantUserProvisioningService;

    @Transactional
    public Tenant registerTenant(TenantRegistrationRequest request) {
        log.info("Registering new tenant: {}", request.getName());

        // 1. Validate Uniqueness
        if (tenantRepository.findBySubdomain(request.getSubdomain()).isPresent()) {
            throw new IllegalArgumentException("Subdomain already taken");
        }

        // 2. Create Tenant Entity (Public Schema)
        Tenant tenant = new Tenant();
        tenant.setName(request.getName());
        tenant.setSubdomain(request.getSubdomain());
        tenant.setActive(true);

        tenant = tenantRepository.save(tenant);

        String schemaName = "tenant_" + tenant.getId().toString().replace("-", "");
        tenant.setSchemaName(schemaName);
        tenant = tenantRepository.save(tenant);
        
        // 3. Create Tenant Schema (Flyway)
        log.info("Creating schema {} for tenant {}", schemaName, tenant.getName());
        flywayConfig.migrateTenant(schemaName);

        // 4. Create Admin User (Tenant Schema)
        // IMPORTANT: Create the admin user in a separate transaction/session so Hibernate
        // picks up the tenant identifier correctly (multi-tenancy is session-scoped).
        tenantUserProvisioningService.createInitialAdmin(schemaName, tenant, request);

        return tenant;
    }
}

