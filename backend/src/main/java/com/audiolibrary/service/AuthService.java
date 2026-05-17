package com.audiolibrary.service;

import com.audiolibrary.config.JwtService;
import com.audiolibrary.config.TenantContext;
import com.audiolibrary.dto.AuthRequest;
import com.audiolibrary.dto.AuthResponse;
import com.audiolibrary.dto.UserRegistrationRequest;
import com.audiolibrary.entity.Tenant;
import com.audiolibrary.entity.User;
import com.audiolibrary.repository.TenantRepository;
import com.audiolibrary.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final PasswordEncoder passwordEncoder;

    /**
     * Authenticate an existing user with email and password.
     */
    public AuthResponse authenticate(AuthRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getEmail(),
                        request.getPassword()
                )
        );

        var user = userRepository.findByEmail(request.getEmail())
                .orElseThrow();

        return buildAuthResponse(user);
    }

    /**
     * Register a new user (self-registration for public listeners).
     * Creates a USER role account within the current tenant context.
     * Returns a JWT token so the user is immediately logged in after registration.
     */
    @Transactional
    public AuthResponse register(UserRegistrationRequest request) {
        String schemaName = TenantContext.getCurrentTenant();
        log.info("User registration attempt: email={}, tenant={}", request.getEmail(), schemaName);

        // Check if email already taken within this tenant
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("An account with this email already exists");
        }

        // Look up tenant UUID from schema name so we can set tenantId on the user,
        // consistent with how TenantUserProvisioningService.createInitialAdmin() works.
        // TenantRepository queries public.tenants (schema="PUBLIC" on entity), not the tenant schema.
        Tenant tenant = tenantRepository.findBySchemaName(schemaName)
                .orElse(null);

        if (tenant == null) {
            log.warn("Could not resolve tenant for schema '{}' — user will have null tenantId", schemaName);
        }

        // Create the user with USER role (not ADMIN, not OWNER)
        User user = new User();
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
        user.setRole(User.Role.USER);

        if (tenant != null) {
            user.setTenantId(tenant.getId());
        }

        User saved = userRepository.save(user);
        log.info("User registered successfully: id={}, email={}, tenantId={}",
                saved.getId(), saved.getEmail(), tenant != null ? tenant.getId() : "null");

        return buildAuthResponse(saved);
    }

    /**
     * Build JWT auth response from a User entity.
     */
    private AuthResponse buildAuthResponse(User user) {
        var userDetails = org.springframework.security.core.userdetails.User.builder()
                .username(user.getEmail())
                .password(user.getPasswordHash())
                .roles(user.getRole().name())
                .build();

        Map<String, Object> extraClaims = new HashMap<>();
        String currentTenant = TenantContext.getCurrentTenant();
        if (currentTenant != null) {
            extraClaims.put("tenant", currentTenant);
        }
        extraClaims.put("role", user.getRole().name());
        extraClaims.put("firstName", user.getFirstName());
        extraClaims.put("lastName", user.getLastName());

        var jwtToken = jwtService.generateToken(extraClaims, userDetails);

        return AuthResponse.builder()
                .token(jwtToken)
                .build();
    }
}