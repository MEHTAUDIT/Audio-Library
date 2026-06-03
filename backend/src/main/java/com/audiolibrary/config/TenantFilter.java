package com.audiolibrary.config;

import com.audiolibrary.entity.Tenant;
import com.audiolibrary.repository.TenantRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Optional;
import java.util.Set;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@Slf4j
public class TenantFilter extends OncePerRequestFilter {

    private final TenantRepository tenantRepository;

    public TenantFilter(TenantRepository tenantRepository) {
        this.tenantRepository = tenantRepository;
    }

    // Paths that should skip tenant filter entirely (no tenant context needed)
    // NOTE: /api/v1/auth is NOT excluded - we need tenant context to find users!
    private static final Set<String> EXCLUDED_PATHS = Set.of(
        "/api/v1/tenants/register",
        "/swagger-ui",
        "/v3/api-docs",
        "/actuator",
        "/h2-console",
        "/error"
    );

    // Hosts that should NOT be treated as tenant identifiers
    private static final Set<String> IGNORED_HOSTS = Set.of(
        "localhost",
        "127.0.0.1",
        "0.0.0.0"
    );

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        boolean shouldSkip = EXCLUDED_PATHS.stream().anyMatch(path::startsWith);
        if (shouldSkip) {
            log.debug("Skipping TenantFilter for path: {}", path);
        }
        return shouldSkip;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String tenantKey = request.getHeader("X-Tenant-ID"); // Typically subdomain
        String resolvedFrom = "header";

        // Browser-native asset requests such as <img src="..."> cannot send the
        // custom tenant header, so allow generated asset URLs to carry it.
        if (tenantKey == null || tenantKey.isBlank()) {
            tenantKey = request.getParameter("tenant");
            resolvedFrom = "query";
        }

        if (tenantKey == null || tenantKey.isBlank()) {
            String host = request.getServerName();
            tenantKey = resolveTenant(host);
            resolvedFrom = "subdomain";

            if (tenantKey != null) {
                log.debug("Tenant resolved from subdomain: host={} tenant={}", host, tenantKey);
            }
        } else {
            log.debug("Tenant resolved from X-Tenant-ID header: {}", tenantKey);
        }

        // Default to "demo" tenant for local development when no tenant specified
        if (tenantKey == null || tenantKey.isBlank()) {
            tenantKey = "demo";
            resolvedFrom = "default";
            log.debug("No tenant specified, defaulting to 'demo' tenant for local development");
        }

        if (tenantKey != null && !tenantKey.isBlank()) {
            // Resolve subdomain -> physical schema name
            Optional<Tenant> tenant = tenantRepository.findBySubdomain(tenantKey);
            if (tenant.isPresent() && tenant.get().getSchemaName() != null && !tenant.get().getSchemaName().isBlank()) {
                Tenant resolvedTenant = tenant.get();
                String schemaName = resolvedTenant.getSchemaName();

                log.info("Tenant context established: tenant={} schema={} resolvedFrom={} active={}",
                        tenantKey, schemaName, resolvedFrom, resolvedTenant.isActive());

                // Check if tenant is active
                if (!resolvedTenant.isActive()) {
                    log.warn("Inactive tenant attempted access: tenant={} schema={}", tenantKey, schemaName);
                    response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                    response.getWriter().write("{\"error\":\"Tenant account is inactive\"}");
                    response.setContentType("application/json");
                    return;
                }

                TenantContext.setCurrentTenant(schemaName);
                request.setAttribute("tenantId", resolvedTenant.getId());
                request.setAttribute("tenantSchema", schemaName);
                request.setAttribute("tenantSubdomain", resolvedTenant.getSubdomain());
            } else {
                // If tenant doesn't exist yet (or missing schemaName), in local we can fall back to using tenantKey directly
                // but generally we keep public schema unless explicitly known.
                log.warn("Tenant not found or missing schema name: tenantKey={} method={} uri={}",
                        tenantKey, request.getMethod(), request.getRequestURI());

                // In production, we should reject unknown tenants
                // For now, log and allow with default schema for local dev compatibility
                log.debug("Continuing with default schema (tenant not resolved)");
            }
        }

        try {
            filterChain.doFilter(request, response);
        } catch (Exception e) {
            log.error("Error during request processing for tenant '{}': {}", tenantKey, e.getMessage(), e);
            throw e;
        } finally {
            log.trace("Clearing tenant context for tenant '{}'", tenantKey);
            TenantContext.clear();
        }
    }

    private String resolveTenant(String host) {
        // Don't treat localhost or IP addresses as tenants
        if (IGNORED_HOSTS.contains(host.toLowerCase())) {
            return null;
        }
        
        // Extract subdomain from host (e.g., "tenant1.audiolib.com" -> "tenant1")
        if (host.contains(".")) {
            String[] parts = host.split("\\.");
            // Only return subdomain if it's not just "www"
            if (parts.length > 0 && !parts[0].equalsIgnoreCase("www")) {
                return parts[0];
            }
        }
        
        return null;
    }
}
