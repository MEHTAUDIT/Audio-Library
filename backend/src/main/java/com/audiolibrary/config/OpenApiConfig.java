package com.audiolibrary.config;

import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
@SecurityScheme(
    name = "bearerAuth",
    type = SecuritySchemeType.HTTP,
    scheme = "bearer",
    bearerFormat = "JWT",
    description = "JWT token authentication. Get token from /api/v1/auth/login"
)
public class OpenApiConfig {

    @Bean
    public OpenAPI openAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Audio Library API")
                        .version("1.0.0")
                        .description("""
                            Multi-tenant Audio Library backend API.
                            
                            ## Authentication
                            1. Call POST /api/v1/auth/login with your credentials
                            2. Copy the token from the response
                            3. Click "Authorize" button and paste: Bearer {token}
                            
                            ## Default Credentials (local)
                            - Tenant: demo
                            - Email: admin@demo.com
                            - Password: securePassword123
                            """)
                        .contact(new Contact()
                                .name("Audio Library Team")
                                .email("support@audiolib.com")))
                .servers(List.of(
                        new Server().url("http://localhost:8080").description("Local Development")
                ));
    }
}


