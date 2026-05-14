package com.audiolibrary.config;

import com.audiolibrary.entity.Audio;
import com.audiolibrary.entity.Tenant;
import com.audiolibrary.entity.User;
import com.audiolibrary.repository.AudioRepository;
import com.audiolibrary.repository.TenantRepository;
import com.audiolibrary.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@Profile("local")
@RequiredArgsConstructor
@Slf4j
public class LocalDataSeeder implements CommandLineRunner {

    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final AudioRepository audioRepository;
    private final FlywayConfig flywayConfig;
    private final PasswordEncoder passwordEncoder;
    private final javax.sql.DataSource dataSource;

    @Override
    public void run(String... args) {
        // Ensure public schema tables exist first
        createPublicSchemaTables();
        
        // Create a default tenant and admin for local development.
        String subdomain = "demo";
        String adminEmail = "admin@demo.com";
        String adminPassword = "securePassword123";

        Tenant tenant = tenantRepository.findBySubdomain(subdomain).orElseGet(() -> {
            Tenant t = new Tenant();
            t.setName("Demo Tenant");
            t.setSubdomain(subdomain);
            t.setActive(true);
            t = tenantRepository.save(t);

            String schemaName = "tenant_" + t.getId().toString().replace("-", "");
            t.setSchemaName(schemaName);
            t = tenantRepository.save(t);

            flywayConfig.migrateTenant(schemaName);
            return t;
        });

        // Ensure tenant schema exists & tables exist (H2 in-memory resets each boot)
        flywayConfig.migrateTenant(tenant.getSchemaName());

        // Seed tenant-scoped data
        log.info("Setting tenant context to: {}", tenant.getSchemaName());
        TenantContext.setCurrentTenant(tenant.getSchemaName());
        try {
            log.info("Checking if user {} exists in tenant {}", adminEmail, TenantContext.getCurrentTenant());
            boolean userExists = userRepository.existsByEmail(adminEmail);
            log.info("User {} exists: {}", adminEmail, userExists);
            
            if (!userExists) {
                User admin = new User();
                admin.setEmail(adminEmail);
                admin.setPasswordHash(passwordEncoder.encode(adminPassword));
                admin.setFirstName("Demo");
                admin.setLastName("Admin");
                admin.setRole(User.Role.ADMIN);
                admin.setTenantId(tenant.getId());
                User savedUser = userRepository.save(admin);
                log.info("Seeded local admin user: {} / {} with ID: {}", adminEmail, adminPassword, savedUser.getId());
            } else {
                log.info("Admin user already exists, skipping creation");
            }

            if (audioRepository.count() == 0) {
                seedAudioFiles(tenant);
                log.info("Seeded {} audio records for tenant '{}'", audioRepository.count(), subdomain);
            }
        } finally {
            TenantContext.clear();
        }
    }

    private void seedAudioFiles(Tenant tenant) {
        // Published audio files (visible to users)
        createAudio(tenant, "Welcome to Audio Library", 
            "An introduction to our audio library platform and its features.",
            "Sarah Johnson", "Getting Started", 180L, Audio.Status.PUBLISHED);
        
        createAudio(tenant, "Product Updates Q4 2024",
            "A comprehensive review of all product updates from the fourth quarter.",
            "Michael Chen", "Updates", 420L, Audio.Status.PUBLISHED);
        
        createAudio(tenant, "Leadership Principles",
            "Essential leadership principles for modern managers and team leads.",
            "Dr. Emily Brown", "Leadership", 1800L, Audio.Status.PUBLISHED);
        
        createAudio(tenant, "Tech Talk: Microservices",
            "Deep dive into microservices architecture and best practices.",
            "Alex Rodriguez", "Technology", 2700L, Audio.Status.PUBLISHED);
        
        createAudio(tenant, "Customer Success Stories",
            "Inspiring stories from our top customers and their journey.",
            "Lisa Wang", "Customer Success", 1200L, Audio.Status.PUBLISHED);
        
        createAudio(tenant, "Annual Company Meeting 2024",
            "Recording from our annual all-hands meeting with key announcements.",
            "CEO David Miller", "Company Updates", 5400L, Audio.Status.PUBLISHED);
        
        // Draft audio files (staging area - needs categorization)
        createAudio(tenant, "Interview: New VP of Engineering",
            "Exclusive interview with our newly appointed VP of Engineering.",
            "HR Team", "Interviews", 2400L, Audio.Status.DRAFT);
        
        createAudio(tenant, "Sales Training Module 1",
            "First module of our comprehensive sales training program.",
            "Training Dept", "Training", 3600L, Audio.Status.DRAFT);
        
        createAudio(tenant, "Podcast Episode #42",
            "Weekly podcast discussing industry trends and news.",
            "Podcast Team", "Podcast", 1800L, Audio.Status.DRAFT);
        
        createAudio(tenant, "Onboarding: Day One Guide",
            "Essential information for new employees on their first day.",
            "HR Team", "Onboarding", 900L, Audio.Status.DRAFT);
        
        createAudio(tenant, "Technical Deep Dive: AI/ML",
            "Understanding artificial intelligence and machine learning basics.",
            "Dr. James Lee", "Technology", 4200L, Audio.Status.DRAFT);
        
        // Archived audio files
        createAudio(tenant, "Product Launch 2023",
            "Historic recording of our major product launch event.",
            "Marketing Team", "Events", 7200L, Audio.Status.ARCHIVED);
        
        createAudio(tenant, "Old Training Materials",
            "Legacy training content kept for reference purposes.",
            "Training Dept", "Training", 5400L, Audio.Status.ARCHIVED);
    }

    private void createAudio(Tenant tenant, String title, String description, 
                             String speaker, String topic, Long durationSeconds, Audio.Status status) {
        Audio audio = new Audio();
        audio.setTenantId(tenant.getId());
        audio.setTitle(title);
        audio.setDescription(description);
        audio.setSpeaker(speaker);
        audio.setTopic(topic);
        audio.setDurationSeconds(durationSeconds);
        audio.setMimeType("audio/mpeg");
        audio.setSizeBytes(durationSeconds * 16000L); // Approximate file size
        audio.setS3Key("local/sample/" + title.toLowerCase().replace(" ", "-") + ".mp3");
        audio.setUrl("http://localhost:8080/api/v1/audio/" + title.hashCode() + "/stream");
        audio.setStatus(status);
        audio.setLanguage("en");
        
        if (status == Audio.Status.PUBLISHED) {
            audio.setPublishedAt(java.time.LocalDateTime.now().minusDays((long) (Math.random() * 30)));
        }
        
        audioRepository.save(audio);
    }

    private void createPublicSchemaTables() {
        log.info("Creating public schema tables for H2...");
        try (java.sql.Connection connection = dataSource.getConnection();
             java.sql.Statement statement = connection.createStatement()) {
            
            // Create tenants table in PUBLIC schema
            statement.execute(
                "CREATE TABLE IF NOT EXISTS PUBLIC.tenants (" +
                "    id UUID PRIMARY KEY," +
                "    name VARCHAR(255)," +
                "    subdomain VARCHAR(100) UNIQUE," +
                "    custom_domain VARCHAR(255)," +
                "    schema_name VARCHAR(100)," +
                "    active BOOLEAN DEFAULT TRUE," +
                "    subscription_plan VARCHAR(50)," +
                "    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
                "    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                ")"
            );
            
            log.info("Public schema tables created successfully");
        } catch (java.sql.SQLException e) {
            log.error("Failed to create public schema tables: {}", e.getMessage());
            throw new RuntimeException("Failed to create public schema tables", e);
        }
    }
}


