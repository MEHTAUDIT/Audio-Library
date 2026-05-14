package com.audiolibrary.service;

import com.audiolibrary.config.TenantContext;
import com.audiolibrary.dto.TenantRegistrationRequest;
import com.audiolibrary.entity.Tenant;
import com.audiolibrary.entity.User;
import com.audiolibrary.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

@Service
@RequiredArgsConstructor
@Slf4j
public class TenantUserProvisioningService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final PlatformTransactionManager transactionManager;

    public void createInitialAdmin(String schemaName, Tenant tenant, TenantRegistrationRequest request) {
        // IMPORTANT: The Hibernate tenant identifier is effectively session/transaction scoped.
        // We must set TenantContext BEFORE starting the transaction to ensure the EntityManager
        // is created with the correct tenant schema.
        TenantContext.setCurrentTenant(schemaName);
        try {
            TransactionTemplate tx = new TransactionTemplate(transactionManager);
            tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
            tx.execute(status -> {
                User admin = new User();
                admin.setEmail(request.getAdminEmail());
                admin.setPasswordHash(passwordEncoder.encode(request.getAdminPassword()));
                admin.setFirstName(request.getAdminFirstName());
                admin.setLastName(request.getAdminLastName());
                admin.setRole(User.Role.ADMIN);
                admin.setTenantId(tenant.getId());

                userRepository.save(admin);
                return null;
            });

            log.info("Admin user created for tenant '{}' in schema '{}'", tenant.getSubdomain(), schemaName);
        } finally {
            TenantContext.clear();
        }
    }
}


