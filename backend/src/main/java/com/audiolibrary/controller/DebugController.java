package com.audiolibrary.controller;

import com.audiolibrary.config.TenantContext;
import com.audiolibrary.entity.Tenant;
import com.audiolibrary.repository.TenantRepository;
import com.audiolibrary.repository.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/debug")
@RequiredArgsConstructor
@Slf4j
@Profile("local")  // Only available in local profile
@Tag(name = "Debug", description = "Debug endpoints (local environment only)")
public class DebugController {

    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;

    @Operation(summary = "Get database state", description = "Shows current tenants and users for debugging. Local profile only.")
    @GetMapping("/state")
    @PreAuthorize("permitAll()")
    public ResponseEntity<Map<String, Object>> getDatabaseState(
            @RequestHeader(value = "X-Tenant-ID", required = false) String tenantSubdomain) {
        
        Map<String, Object> state = new HashMap<>();
        
        // Current context
        state.put("currentTenantContext", TenantContext.getCurrentTenant());
        state.put("requestedTenant", tenantSubdomain);
        
        // All tenants
        List<Map<String, Object>> tenants = tenantRepository.findAll().stream()
                .map(t -> {
                    Map<String, Object> tm = new HashMap<>();
                    tm.put("id", t.getId());
                    tm.put("name", t.getName());
                    tm.put("subdomain", t.getSubdomain());
                    tm.put("schemaName", t.getSchemaName());
                    tm.put("active", t.isActive());
                    return tm;
                })
                .collect(Collectors.toList());
        state.put("tenants", tenants);
        
        // If tenant specified, check users in that tenant
        if (tenantSubdomain != null) {
            Tenant tenant = tenantRepository.findBySubdomain(tenantSubdomain).orElse(null);
            if (tenant != null && tenant.getSchemaName() != null) {
                String previousContext = TenantContext.getCurrentTenant();
                try {
                    TenantContext.setCurrentTenant(tenant.getSchemaName());
                    long userCount = userRepository.count();
                    state.put("usersInTenant", userCount);
                    
                    // Get user emails
                    List<String> userEmails = userRepository.findAll().stream()
                            .map(u -> u.getEmail())
                            .collect(Collectors.toList());
                    state.put("userEmails", userEmails);
                } finally {
                    if (previousContext != null) {
                        TenantContext.setCurrentTenant(previousContext);
                    } else {
                        TenantContext.clear();
                    }
                }
            }
        }
        
        return ResponseEntity.ok(state);
    }

    @Operation(summary = "Verify token tenant", description = "Check if the tenant in your JWT token still exists. Local profile only.")
    @GetMapping("/verify-token")
    @PreAuthorize("permitAll()")
    public ResponseEntity<Map<String, Object>> verifyToken(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        
        Map<String, Object> result = new HashMap<>();
        
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            result.put("error", "No Bearer token provided");
            return ResponseEntity.ok(result);
        }
        
        String token = authHeader.substring(7);
        
        try {
            // Decode JWT payload (middle part)
            String[] parts = token.split("\\.");
            if (parts.length != 3) {
                result.put("error", "Invalid JWT format");
                return ResponseEntity.ok(result);
            }
            
            String payload = new String(java.util.Base64.getUrlDecoder().decode(parts[1]));
            result.put("tokenPayload", payload);
            
            // Extract tenant from payload
            if (payload.contains("\"tenant\"")) {
                int start = payload.indexOf("\"tenant\":\"") + 10;
                int end = payload.indexOf("\"", start);
                String tenantFromToken = payload.substring(start, end);
                result.put("tenantInToken", tenantFromToken);
                
                // Check if this schema exists by looking at tenants
                List<String> existingSchemas = tenantRepository.findAll().stream()
                        .map(Tenant::getSchemaName)
                        .collect(Collectors.toList());
                result.put("existingSchemas", existingSchemas);
                result.put("tokenSchemaExists", existingSchemas.contains(tenantFromToken));
            } else {
                result.put("tenantInToken", null);
                result.put("warning", "Token does not contain tenant claim - you may need to login again");
            }
            
        } catch (Exception e) {
            result.put("error", "Failed to decode token: " + e.getMessage());
        }
        
        return ResponseEntity.ok(result);
    }
}
