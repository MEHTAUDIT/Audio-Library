package com.audiolibrary.controller;

import com.audiolibrary.dto.TenantRegistrationRequest;
import com.audiolibrary.dto.TenantResponse;
import com.audiolibrary.entity.Tenant;
import com.audiolibrary.service.TenantService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TenantControllerUnitTest {

    @Mock private TenantService tenantService;
    @InjectMocks private TenantController tenantController;

    @Test
    void registerTenant_returnsTenantResponse() {
        TenantRegistrationRequest req = new TenantRegistrationRequest();
        req.setName("Test Tenant");
        req.setSubdomain("test");
        req.setAdminEmail("admin@test.com");
        req.setAdminPassword("password123");
        req.setAdminFirstName("Test");
        req.setAdminLastName("Admin");

        Tenant tenant = new Tenant();
        tenant.setId(UUID.randomUUID());
        tenant.setName("Test Tenant");
        tenant.setSubdomain("test");
        tenant.setSchemaName("tenant_123");
        tenant.setActive(true);

        when(tenantService.registerTenant(req)).thenReturn(tenant);

        ResponseEntity<TenantResponse> resp = tenantController.registerTenant(req);

        assertThat(resp.getStatusCode().value()).isEqualTo(200);
        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody().getSubdomain()).isEqualTo("test");
    }
}
