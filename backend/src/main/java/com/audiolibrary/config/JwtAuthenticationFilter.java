package com.audiolibrary.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    private static final Set<String> EXCLUDED_PATHS = Set.of(
            "/api/v1/tenants/register",
            "/api/v1/auth",
            "/swagger-ui",
            "/v3/api-docs",
            "/actuator",
            "/h2-console",
            "/error"
    );

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        String path = request.getRequestURI();
        return EXCLUDED_PATHS.stream().anyMatch(path::startsWith);
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        final String authHeader = request.getHeader("Authorization");
        final String jwt;
        final String userEmail;
        
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }
        
        jwt = authHeader.substring(7);
        userEmail = jwtService.extractUsername(jwt);
        log.debug("JWT auth filter - userEmail: {}", userEmail);
        
        // Extract tenant from JWT and validate/set context
        String tenantFromToken = jwtService.extractClaim(jwt, claims -> claims.get("tenant", String.class));
        String currentTenant = TenantContext.getCurrentTenant();
        log.debug("JWT auth filter - tenant from token: {}, current context: {}", tenantFromToken, currentTenant);
        
        if (tenantFromToken != null) {
            if (currentTenant == null) {
                // No tenant context set yet, use the one from token
                log.debug("JWT auth filter - setting tenant context to: {}", tenantFromToken);
                TenantContext.setCurrentTenant(tenantFromToken);
            } else if (!tenantFromToken.equals(currentTenant)) {
                // Tenant mismatch - token is for a different tenant than the request
                // This could happen if someone reuses a token with a different X-Tenant-ID header
                log.warn("JWT auth filter - tenant mismatch! Token tenant: {}, request tenant: {}. Using token tenant.", 
                        tenantFromToken, currentTenant);
                TenantContext.setCurrentTenant(tenantFromToken);
            }
        }
        
        if (userEmail != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            final UserDetails userDetails;
            try {
                log.debug("JWT auth filter - loading user: {} with tenant: {}", userEmail, TenantContext.getCurrentTenant());
                userDetails = this.userDetailsService.loadUserByUsername(userEmail);
                log.debug("JWT auth filter - user loaded successfully: {}", userDetails.getUsername());
            } catch (UsernameNotFoundException ex) {
                log.warn("JWT auth filter - user not found: {} in tenant: {}", userEmail, TenantContext.getCurrentTenant());
                // If the token refers to a user that doesn't exist in the current tenant schema,
                // do not fail the request here. Downstream security rules will decide access.
                filterChain.doFilter(request, response);
                return;
            }
            
            if (jwtService.isTokenValid(jwt, userDetails)) {
                log.debug("JWT auth filter - token is valid, setting authentication");
                UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                        userDetails,
                        null,
                        userDetails.getAuthorities()
                );
                authToken.setDetails(
                        new WebAuthenticationDetailsSource().buildDetails(request)
                );
                SecurityContextHolder.getContext().setAuthentication(authToken);
            } else {
                log.warn("JWT auth filter - token is invalid for user: {}", userEmail);
            }
        }
        filterChain.doFilter(request, response);
    }
}

