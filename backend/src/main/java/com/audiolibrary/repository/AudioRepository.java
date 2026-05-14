package com.audiolibrary.repository;

import com.audiolibrary.entity.Audio;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AudioRepository extends JpaRepository<Audio, UUID> {
    
    List<Audio> findByDeletedAtIsNull();
    
    List<Audio> findByStatusAndDeletedAtIsNull(Audio.Status status);
    
    long countByDeletedAtIsNull();
    
    long countByStatusAndDeletedAtIsNull(Audio.Status status);
    
    List<Audio> findByTenantIdAndDeletedAtIsNull(UUID tenantId);
    
    List<Audio> findByTenantIdAndStatusAndDeletedAtIsNull(UUID tenantId, Audio.Status status);
}


