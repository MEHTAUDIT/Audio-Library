package com.audiolibrary.repository;

import com.audiolibrary.entity.UserPreferences;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface UserPreferencesRepository extends JpaRepository<UserPreferences, UUID> {
    // Primary key is user_id, so findById(userId) works directly
}





