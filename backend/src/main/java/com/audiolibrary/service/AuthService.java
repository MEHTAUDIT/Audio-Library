package com.audiolibrary.service;

import com.audiolibrary.config.JwtService;
import com.audiolibrary.config.TenantContext;
import com.audiolibrary.dto.AuthRequest;
import com.audiolibrary.dto.AuthResponse;
import com.audiolibrary.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;

    public AuthResponse authenticate(AuthRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getEmail(),
                        request.getPassword()
                )
        );

        var user = userRepository.findByEmail(request.getEmail())
                .orElseThrow();
        
        // We need to adapt our User entity to Spring Security UserDetails
        var userDetails = org.springframework.security.core.userdetails.User.builder()
                .username(user.getEmail())
                .password(user.getPasswordHash())
                .roles(user.getRole().name())
                .build();
        
        // Include tenant schema in the JWT claims
        Map<String, Object> extraClaims = new HashMap<>();
        String currentTenant = TenantContext.getCurrentTenant();
        if (currentTenant != null) {
            extraClaims.put("tenant", currentTenant);
        }
        
        var jwtToken = jwtService.generateToken(extraClaims, userDetails);
        
        return AuthResponse.builder()
                .token(jwtToken)
                .build();
    }
}

