package com.audiolibrary.controller;

import com.audiolibrary.dto.AuthRequest;
import com.audiolibrary.dto.AuthResponse;
import com.audiolibrary.service.AuthService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthControllerUnitTest {

    @Mock private AuthService authService;
    @InjectMocks private AuthController authController;

    @Test
    void login_returnsToken() {
        AuthRequest req = AuthRequest.builder()
                .email("admin@demo.com")
                .password("pw")
                .build();
        String tenantId = "demo";

        when(authService.authenticate(req))
                .thenReturn(AuthResponse.builder().token("jwt-token").build());

        ResponseEntity<AuthResponse> resp = authController.login(req, tenantId);

        assertThat(resp.getStatusCode().value()).isEqualTo(200);
        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody().getToken()).isEqualTo("jwt-token");
    }
}
