package com.audiolibrary.controller;

import com.audiolibrary.config.TenantContext;
import com.audiolibrary.dto.AuthRequest;
import com.audiolibrary.dto.AuthResponse;
import com.audiolibrary.dto.UserRegistrationRequest;
import com.audiolibrary.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Authentication", description = "User authentication and registration endpoints")
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

    @Operation(
        summary = "Register new user",
        description = """
            Register a new listener account (USER role) within a tenant.
            Returns a JWT token so the user is immediately logged in after registration.
            
            **Required Header:** X-Tenant-ID (e.g., 'demo')
            
            This is for public self-registration — creates a USER role, not ADMIN.
            """
    )
    @PostMapping("/register")
    @PreAuthorize("permitAll()")
    public ResponseEntity<?> register(
            @Valid @RequestBody UserRegistrationRequest request,
            @Parameter(description = "Tenant subdomain", example = "demo")
            @RequestHeader(value = "X-Tenant-ID", required = true) String tenantId) {
        try {
            log.info("Registration attempt for email: {} in tenant: {}", request.getEmail(), TenantContext.getCurrentTenant());
            AuthResponse response = authService.register(request);
            log.info("Registration successful for: {}", request.getEmail());
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            log.warn("Registration failed for {}: {}", request.getEmail(), e.getMessage());
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @Operation(summary = "Check auth status", description = "Check current authentication status and tenant context")
    @GetMapping("/status")
    @PreAuthorize("permitAll()")
    public ResponseEntity<Map<String, Object>> getStatus() {
        Map<String, Object> status = new HashMap<>();
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