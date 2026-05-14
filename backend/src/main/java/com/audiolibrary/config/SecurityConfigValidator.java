package com.audiolibrary.config;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

import java.util.Arrays;

/**
 * Validates security configuration at startup.
 * Ensures that sensitive defaults are not used in production environments.
 */
@Configuration
@Slf4j
public class SecurityConfigValidator {

    private static final String DEV_SECRET_PREFIX = "6C6F63616C2D6465762D"; // "local-dev-" in hex
    
    @Value("${application.security.jwt.secret-key:}")
    private String jwtSecretKey;
    
    private final Environment environment;
    
    public SecurityConfigValidator(Environment environment) {
        this.environment = environment;
    }
    
    @PostConstruct
    public void validateSecurityConfig() {
        String[] activeProfiles = environment.getActiveProfiles();
        boolean isProduction = Arrays.stream(activeProfiles)
                .anyMatch(profile -> profile.equalsIgnoreCase("prod") || 
                                     profile.equalsIgnoreCase("production"));
        
        // Check JWT secret key
        if (jwtSecretKey == null || jwtSecretKey.isBlank()) {
            if (isProduction) {
                throw new IllegalStateException(
                    "JWT secret key is not configured! " +
                    "Set the JWT_SECRET_KEY environment variable. " +
                    "Generate one with: openssl rand -hex 32"
                );
            } else {
                log.warn("JWT secret key is not configured. " +
                         "This is acceptable for development but MUST be set in production.");
            }
        }
        
        // Check for development secret in production
        if (isProduction && jwtSecretKey != null && jwtSecretKey.startsWith(DEV_SECRET_PREFIX)) {
            throw new IllegalStateException(
                "Development JWT secret detected in production! " +
                "Set a secure JWT_SECRET_KEY environment variable. " +
                "Generate one with: openssl rand -hex 32"
            );
        }
        
        // Warn about short secrets
        if (jwtSecretKey != null && !jwtSecretKey.isBlank() && jwtSecretKey.length() < 64) {
            log.warn("JWT secret key is shorter than recommended (64 hex characters / 256 bits). " +
                     "Consider using a longer key for better security.");
        }
        
        if (isProduction) {
            log.info("Security configuration validated for production environment");
        } else {
            log.info("Running in development mode - some security checks relaxed");
        }
    }
}


