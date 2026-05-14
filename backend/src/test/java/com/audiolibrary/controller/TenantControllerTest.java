package com.audiolibrary.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Tag("integration")
class TenantControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @Test
    void registerTenant_returns200_andTenantWithSchemaName() throws Exception {
        String subdomain = "t" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        Map<String, Object> body = Map.of(
                "name", "Test Tenant",
                "subdomain", subdomain,
                "adminEmail", "admin@" + subdomain + ".com",
                "adminPassword", "password123",
                "adminFirstName", "Test",
                "adminLastName", "Admin"
        );

        mockMvc.perform(post("/api/v1/tenants/register")
                        // Simulate a browser that has a stale token in localStorage.
                        .header("Authorization", "Bearer stale.token.value")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.subdomain").value(subdomain))
                .andExpect(jsonPath("$.schemaName").isNotEmpty());
    }

    @Test
    void afterRegister_canLoginWithTenantSubdomain() throws Exception {
        String subdomain = "t" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        String email = "admin@" + subdomain + ".com";
        String password = "password123";

        Map<String, Object> reg = Map.of(
                "name", "Test Tenant",
                "subdomain", subdomain,
                "adminEmail", email,
                "adminPassword", password,
                "adminFirstName", "Test",
                "adminLastName", "Admin"
        );

        mockMvc.perform(post("/api/v1/tenants/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reg)))
                .andExpect(status().isOk());

        Map<String, Object> login = Map.of(
                "email", email,
                "password", password
        );

        mockMvc.perform(post("/api/v1/auth/login")
                        .header("X-Tenant-ID", subdomain)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(login)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty());
    }

    @Test
    void registerTenant_duplicateSubdomain_returns400() throws Exception {
        String subdomain = "dup" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        Map<String, Object> body = Map.of(
                "name", "Tenant 1",
                "subdomain", subdomain,
                "adminEmail", "admin@" + subdomain + ".com",
                "adminPassword", "password123",
                "adminFirstName", "A",
                "adminLastName", "B"
        );

        mockMvc.perform(post("/api/v1/tenants/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/tenants/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("bad_request"));
    }
}


