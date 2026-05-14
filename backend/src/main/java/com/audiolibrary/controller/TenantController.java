package com.audiolibrary.controller;

import com.audiolibrary.dto.TenantRegistrationRequest;
import com.audiolibrary.dto.TenantResponse;
import com.audiolibrary.entity.Tenant;
import com.audiolibrary.repository.TenantRepository;
import com.audiolibrary.service.TenantService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/tenants")
@RequiredArgsConstructor
@Tag(name = "Tenants", description = "Tenant management endpoints")
public class TenantController {

    private final TenantService tenantService;
    private final TenantRepository tenantRepository;

    @Operation(summary = "Register new tenant", description = "Register a new tenant organization. This endpoint is public.")
    @PostMapping("/register")
    @PreAuthorize("permitAll()")
    public ResponseEntity<TenantResponse> registerTenant(@Valid @RequestBody TenantRegistrationRequest request) {
        Tenant tenant = tenantService.registerTenant(request);
        return ResponseEntity.ok(TenantResponse.fromEntity(tenant));
    }

    @Operation(summary = "Get all tenants", description = "Get a list of all registered tenants. Requires ADMIN or OWNER role.")
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<List<TenantResponse>> getAllTenants() {
        List<TenantResponse> tenants = tenantRepository.findAll().stream()
                .map(TenantResponse::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(tenants);
    }

    @Operation(summary = "Get tenant by ID", description = "Get a specific tenant by UUID. Requires ADMIN or OWNER role.")
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<TenantResponse> getTenantById(@PathVariable UUID id) {
        Tenant tenant = tenantRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Tenant not found: " + id));
        return ResponseEntity.ok(TenantResponse.fromEntity(tenant));
    }

    @Operation(summary = "Get tenant by subdomain", description = "Get a specific tenant by subdomain. This endpoint is public for tenant lookup.")
    @GetMapping("/subdomain/{subdomain}")
    @PreAuthorize("permitAll()")
    public ResponseEntity<TenantResponse> getTenantBySubdomain(@PathVariable String subdomain) {
        Tenant tenant = tenantRepository.findBySubdomain(subdomain)
                .orElseThrow(() -> new RuntimeException("Tenant not found: " + subdomain));
        return ResponseEntity.ok(TenantResponse.fromEntity(tenant));
    }
}
