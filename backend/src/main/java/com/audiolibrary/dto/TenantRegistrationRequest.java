package com.audiolibrary.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class TenantRegistrationRequest {

    @NotBlank(message = "Tenant name is required")
    private String name;

    @NotBlank(message = "Subdomain is required")
    @Pattern(regexp = "^[a-z0-9-]+$", message = "Subdomain must consist of lowercase letters, numbers, and hyphens")
    private String subdomain;

    @NotBlank(message = "Admin email is required")
    @Email(message = "Invalid email format")
    private String adminEmail;

    @NotBlank(message = "Password is required")
    private String adminPassword;
    
    private String adminFirstName;
    private String adminLastName;
}

