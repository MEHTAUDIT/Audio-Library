package com.audiolibrary.controller;

import com.audiolibrary.config.TenantContext;
import com.audiolibrary.dto.AuthRequest;
import com.audiolibrary.dto.AuthResponse;
import com.audiolibrary.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Authentication", description = "User authentication endpoints")
public class AuthController {

    private final AuthService authService;

    @Operation(
        summary = "Login", 
        description = """
            Authenticate with email and password. 
            
            **Required Header:** X-Tenant-ID (e.g., 'demo')
            
            **Test Credentials:**
            - Email: admin@demo.com
            - Password: securePassword123
            """
    )
    @PostMapping("/login")
    @PreAuthorize("permitAll()")
    public ResponseEntity<AuthResponse> login(
            @RequestBody AuthRequest request,
            @Parameter(description = "Tenant subdomain", example = "demo")
            @RequestHeader(value = "X-Tenant-ID", required = true) String tenantId) {
        log.info("Login attempt for email: {} in tenant context: {}", request.getEmail(), TenantContext.getCurrentTenant());
        AuthResponse response = authService.authenticate(request);
        log.info("Login successful for: {}", request.getEmail());
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Check auth status", description = "Check current authentication status and tenant context")
    @GetMapping("/status")
    @PreAuthorize("permitAll()")
    public ResponseEntity<java.util.Map<String, Object>> getStatus() {
        java.util.Map<String, Object> status = new java.util.HashMap<>();
        status.put("tenantContext", TenantContext.getCurrentTenant());
        
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            status.put("authenticated", true);
            status.put("principal", auth.getName());
            status.put("authorities", auth.getAuthorities().toString());
        } else {
            status.put("authenticated", false);
        }
        
        return ResponseEntity.ok(status);
    }
}
