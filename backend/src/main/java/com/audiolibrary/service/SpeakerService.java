package com.audiolibrary.service;

import com.audiolibrary.config.TenantContext;
import com.audiolibrary.dto.AudioResponse;
import com.audiolibrary.dto.SpeakerUpsertRequest;
import com.audiolibrary.entity.Audio;
import com.audiolibrary.entity.AudioSpeakerJoin;
import com.audiolibrary.entity.AudioSpeakerJoinId;
import com.audiolibrary.entity.Speaker;
import com.audiolibrary.entity.UserFavoriteSpeakerJoin;
import com.audiolibrary.repository.AudioRepository;
import com.audiolibrary.repository.AudioSpeakerJoinRepository;
import com.audiolibrary.repository.SpeakerRepository;
import com.audiolibrary.repository.UserFavoriteSpeakerJoinRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class SpeakerService {

    private static final String STORAGE_AVATAR_PREFIX = "storage:";
    private static final long MAX_PROFILE_IMAGE_SIZE_BYTES = 5L * 1024 * 1024;
    private static final Set<String> ALLOWED_PROFILE_IMAGE_TYPES = Set.of(
            "image/jpeg", "image/png", "image/webp", "image/gif");

    private final SpeakerRepository speakerRepository;
    private final AudioSpeakerJoinRepository audioSpeakerJoinRepository;
    private final AudioRepository audioRepository;
    private final UserFavoriteSpeakerJoinRepository favoriteSpeakerJoinRepository;
    private final StorageService storageService;

    /**
     * Create a new speaker.
     */
    public AudioResponse.SpeakerProfileResponse createSpeaker(UUID tenantId, SpeakerUpsertRequest request) {
        validateSpeakerName(tenantId, request.getName(), null);

        Speaker speaker = new Speaker();
        speaker.setTenantId(tenantId);
        speaker.setName(request.getName().trim());
        speaker.setBio(cleanNullableString(request.getBio()));
        speaker.setAvatarUrl(cleanNullableString(request.getProfileImageUrl()));
        speaker.setWebsiteUrl(cleanNullableString(request.getWebsiteUrl()));

        Speaker saved = speakerRepository.save(speaker);
        log.info("Created speaker: id={} name='{}' tenant={}", saved.getId(), saved.getName(), tenantId);

        return buildSpeakerProfileResponse(saved);
    }

    /**
     * Get all active speakers for a tenant.
     */
    @Transactional(readOnly = true)
    public List<Speaker> getAllSpeakers(UUID tenantId) {
        return speakerRepository.findAllActiveByTenantId(tenantId);
    }

    /**
     * Get speakers with pagination.
     */
    @Transactional(readOnly = true)
    public Page<Speaker> getSpeakers(UUID tenantId, Pageable pageable) {
        return speakerRepository.findAllActiveByTenantId(tenantId, pageable);
    }

    /**
     * Find speaker by ID.
     */
    @Transactional(readOnly = true)
    public Optional<Speaker> findById(UUID speakerId) {
        return speakerRepository.findActiveById(speakerId);
    }

    /**
     * Search speakers by name.
     */
    @Transactional(readOnly = true)
    public Page<Speaker> searchSpeakers(UUID tenantId, String query, Pageable pageable) {
        return speakerRepository.searchByName(tenantId, query, pageable);
    }

    @Transactional(readOnly = true)
    public List<AudioResponse.SpeakerResponse> listSpeakerSummaries(UUID tenantId, String query) {
        List<Speaker> speakers;
        if (StringUtils.hasText(query)) {
            speakers = speakerRepository
                    .searchByName(tenantId, query.trim(), PageRequest.of(0, 10, Sort.by("name").ascending()))
                    .getContent();
        } else {
            speakers = speakerRepository.findAllActiveByTenantId(tenantId);
        }

        return speakers.stream()
                .map(speaker -> AudioResponse.SpeakerResponse.builder()
                        .id(speaker.getId())
                        .name(speaker.getName())
                        .avatarUrl(getPublicAvatarUrl(speaker))
                        .build())
                .toList();
    }

    /**
     * Update speaker details.
     */
    public AudioResponse.SpeakerProfileResponse updateSpeaker(UUID tenantId, UUID speakerId, SpeakerUpsertRequest request) {
        Speaker speaker = getSpeakerForTenant(tenantId, speakerId);

        if (StringUtils.hasText(request.getName())) {
            validateSpeakerName(tenantId, request.getName(), speakerId);
            speaker.setName(request.getName().trim());
        }
        if (request.getBio() != null) {
            speaker.setBio(cleanNullableString(request.getBio()));
        }
        if (request.getProfileImageUrl() != null) {
            speaker.setAvatarUrl(cleanNullableString(request.getProfileImageUrl()));
        }
        if (request.getWebsiteUrl() != null) {
            speaker.setWebsiteUrl(cleanNullableString(request.getWebsiteUrl()));
        }
        
        Speaker saved = speakerRepository.save(speaker);
        log.info("Updated speaker: id={} name='{}'", saved.getId(), saved.getName());

        return buildSpeakerProfileResponse(saved);
    }

    public AudioResponse.SpeakerProfileResponse updateProfileImage(
            UUID tenantId,
            UUID speakerId,
            MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Profile image file is required");
        }
        if (file.getSize() > MAX_PROFILE_IMAGE_SIZE_BYTES) {
            throw new IllegalArgumentException("Profile image must be 5MB or smaller");
        }
        String contentType = file.getContentType();
        if (!StringUtils.hasText(contentType) || !ALLOWED_PROFILE_IMAGE_TYPES.contains(contentType.toLowerCase())) {
            throw new IllegalArgumentException("Profile image must be a JPG, PNG, WEBP, or GIF file");
        }

        Speaker speaker = getSpeakerForTenant(tenantId, speakerId);
        String previousAvatar = speaker.getAvatarUrl();
        String storageKey = storageService.storeFile(file, tenantId);

        speaker.setAvatarUrl(STORAGE_AVATAR_PREFIX + storageKey);
        Speaker saved = speakerRepository.save(speaker);

        if (isStoredAvatar(previousAvatar)) {
            storageService.deleteFile(previousAvatar.substring(STORAGE_AVATAR_PREFIX.length()));
        }

        log.info("Updated speaker profile image: id={} tenant={}", speakerId, tenantId);
        return buildSpeakerProfileResponse(saved);
    }

    @Transactional(readOnly = true)
    public String getProfileImageStorageKey(UUID speakerId) {
        Speaker speaker = speakerRepository.findActiveById(speakerId)
                .orElseThrow(() -> new IllegalArgumentException("Speaker not found: " + speakerId));
        if (!isStoredAvatar(speaker.getAvatarUrl())) {
            throw new IllegalArgumentException("Speaker does not have an uploaded profile image");
        }
        return speaker.getAvatarUrl().substring(STORAGE_AVATAR_PREFIX.length());
    }

    /**
     * Soft delete a speaker.
     */
    public void deleteSpeaker(UUID speakerId) {
        Speaker speaker = speakerRepository.findActiveById(speakerId)
                .orElseThrow(() -> new IllegalArgumentException("Speaker not found: " + speakerId));
        speaker.setDeletedAt(LocalDateTime.now());
        speakerRepository.save(speaker);
    }

    /**
     * Add speaker to audio.
     */
    public void addSpeakerToAudio(UUID audioId, UUID speakerId, AudioSpeakerJoin.Role role, Integer displayOrder) {
        if (audioSpeakerJoinRepository.existsByAudioIdAndSpeakerId(audioId, speakerId)) {
            return; // Already linked
        }
        
        Audio audio = audioRepository.findById(audioId)
                .orElseThrow(() -> new IllegalArgumentException("Audio not found: " + audioId));
        Speaker speaker = speakerRepository.findActiveById(speakerId)
                .orElseThrow(() -> new IllegalArgumentException("Speaker not found: " + speakerId));
        
        AudioSpeakerJoin audioSpeakerJoin = new AudioSpeakerJoin();
        audioSpeakerJoin.setId(new AudioSpeakerJoinId(audioId, speakerId));
        audioSpeakerJoin.setAudio(audio);
        audioSpeakerJoin.setSpeaker(speaker);
        audioSpeakerJoin.setRole(role != null ? role : AudioSpeakerJoin.Role.SPEAKER);
        audioSpeakerJoin.setDisplayOrder(displayOrder);
        
        audioSpeakerJoinRepository.save(audioSpeakerJoin);
    }

    /**
     * Remove speaker from audio.
     */
    public void removeSpeakerFromAudio(UUID audioId, UUID speakerId) {
        AudioSpeakerJoinId id = new AudioSpeakerJoinId(audioId, speakerId);
        audioSpeakerJoinRepository.deleteById(id);
    }

    /**
     * Get speakers for an audio.
     */
    @Transactional(readOnly = true)
    public List<Speaker> getSpeakersForAudio(UUID audioId) {
        return audioSpeakerJoinRepository.findAllByAudioId(audioId).stream()
                .map(AudioSpeakerJoin::getSpeaker)
                .collect(Collectors.toList());
    }

    /**
     * Get audio files for a speaker.
     */
    @Transactional(readOnly = true)
    public List<Audio> getAudioForSpeaker(UUID speakerId) {
        return audioSpeakerJoinRepository.findAllBySpeakerId(speakerId).stream()
                .map(AudioSpeakerJoin::getAudio)
                .filter(a -> a.getDeletedAt() == null) // Only active audio
                .collect(Collectors.toList());
    }

    /**
     * Get follower count for speaker.
     */
    @Transactional(readOnly = true)
    public long getFollowerCount(UUID speakerId) {
        return favoriteSpeakerJoinRepository.countBySpeakerId(speakerId);
    }

    /**
     * Get audio count for speaker.
     */
    @Transactional(readOnly = true)
    public long getAudioCount(UUID speakerId) {
        return audioSpeakerJoinRepository.countBySpeakerId(speakerId);
    }

    /**
     * Get users subscribed to speaker notifications.
     */
    @Transactional(readOnly = true)
    public List<UserFavoriteSpeakerJoin> getSubscribedUsers(UUID speakerId) {
        return favoriteSpeakerJoinRepository.findAllSubscribedToSpeaker(speakerId);
    }


    @Transactional(readOnly = true)
    public ResponseEntity<AudioResponse.SpeakerProfileResponse> getSpeaker(UUID tenantId, UUID speakerId) {

        log.info("Current tenant: {}", TenantContext.getCurrentTenant());

        Speaker speaker = getSpeakerForTenant(tenantId, speakerId);

        List<AudioResponse> audios = audioRepository
                .findAllBySpeakerId(speakerId)
                .stream()
                .map(AudioResponse::fromEntity)
                .toList();

        AudioResponse.SpeakerProfileResponse response =
                AudioResponse.SpeakerProfileResponse.builder()
                        .speakerId(speaker.getId())
                        .name(speaker.getName())
                        .bio(speaker.getBio())
                        .profileImageUrl(getPublicAvatarUrl(speaker))
                        .websiteUrl(speaker.getWebsiteUrl())
                        .totalAudioCount((long) audios.size())
                        .audios(audios)
                        .build();

        return ResponseEntity.ok(response);
    }

    private void validateSpeakerName(UUID tenantId, String name, UUID currentSpeakerId) {
        if (!StringUtils.hasText(name)) {
            throw new IllegalArgumentException("Speaker name is required");
        }

        speakerRepository.findByTenantIdAndNameIgnoreCaseAndDeletedAtIsNull(tenantId, name.trim())
                .filter(existing -> currentSpeakerId == null || !existing.getId().equals(currentSpeakerId))
                .ifPresent(existing -> {
                    throw new IllegalArgumentException("Speaker already exists: " + name.trim());
                });
    }

    private String cleanNullableString(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }

    private Speaker getSpeakerForTenant(UUID tenantId, UUID speakerId) {
        Speaker speaker = speakerRepository.findActiveById(speakerId)
                .orElseThrow(() -> new IllegalArgumentException("Speaker not found: " + speakerId));
        if (!tenantId.equals(speaker.getTenantId())) {
            throw new IllegalArgumentException("Speaker not found: " + speakerId);
        }
        return speaker;
    }

    private boolean isStoredAvatar(String avatarUrl) {
        return StringUtils.hasText(avatarUrl) && avatarUrl.startsWith(STORAGE_AVATAR_PREFIX);
    }

    private String getPublicAvatarUrl(Speaker speaker) {
        if (isStoredAvatar(speaker.getAvatarUrl())) {
            String storageKey = speaker.getAvatarUrl().substring(STORAGE_AVATAR_PREFIX.length());
            String version = Integer.toUnsignedString(storageKey.hashCode());
            return "/api/v1/speaker/" + speaker.getId() + "/profile-image?v=" + version;
        }
        return speaker.getAvatarUrl();
    }

    private AudioResponse.SpeakerProfileResponse buildSpeakerProfileResponse(Speaker speaker) {
        List<AudioResponse> audios = audioRepository
                .findAllBySpeakerId(speaker.getId())
                .stream()
                .map(AudioResponse::fromEntity)
                .toList();

        return AudioResponse.SpeakerProfileResponse.builder()
                .speakerId(speaker.getId())
                .name(speaker.getName())
                .bio(speaker.getBio())
                .websiteUrl(speaker.getWebsiteUrl())
                .profileImageUrl(getPublicAvatarUrl(speaker))
                .totalAudioCount((long) audios.size())
                .audios(audios)
                .build();
    }
}
