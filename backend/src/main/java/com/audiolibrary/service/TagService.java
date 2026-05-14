package com.audiolibrary.service;

import com.audiolibrary.entity.Audio;
import com.audiolibrary.entity.AudioTagJoin;
import com.audiolibrary.entity.AudioTagJoinId;
import com.audiolibrary.entity.Tag;
import com.audiolibrary.repository.AudioRepository;
import com.audiolibrary.repository.AudioTagJoinRepository;
import com.audiolibrary.repository.TagRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class TagService {

    private final TagRepository tagRepository;
    private final AudioTagJoinRepository audioTagJoinRepository;
    private final AudioRepository audioRepository;

    /**
     * Create a new tag.
     */
    public Tag createTag(UUID tenantId, String name, String description, String color) {
        String slug = Tag.generateSlug(name);
        
        // Ensure unique slug
        String baseSlug = slug;
        int counter = 1;
        while (tagRepository.existsByTenantIdAndSlugAndDeletedAtIsNull(tenantId, slug)) {
            slug = baseSlug + "-" + counter++;
        }
        
        Tag tag = new Tag();
        tag.setTenantId(tenantId);
        tag.setName(name);
        tag.setSlug(slug);
        tag.setDescription(description);
        tag.setColor(color);
        tag.setUsageCount(0L);
        
        return tagRepository.save(tag);
    }

    /**
     * Get all active tags for a tenant.
     */
    @Transactional(readOnly = true)
    public List<Tag> getAllTags(UUID tenantId) {
        return tagRepository.findAllActiveByTenantId(tenantId);
    }

    /**
     * Get tags with pagination.
     */
    @Transactional(readOnly = true)
    public Page<Tag> getTags(UUID tenantId, Pageable pageable) {
        return tagRepository.findAllActiveByTenantId(tenantId, pageable);
    }

    /**
     * Find tag by ID.
     */
    @Transactional(readOnly = true)
    public Optional<Tag> findById(UUID tagId) {
        return tagRepository.findActiveById(tagId);
    }

    /**
     * Find tag by slug.
     */
    @Transactional(readOnly = true)
    public Optional<Tag> findBySlug(UUID tenantId, String slug) {
        return tagRepository.findByTenantIdAndSlug(tenantId, slug);
    }

    /**
     * Search tags by name.
     */
    @Transactional(readOnly = true)
    public List<Tag> searchTags(UUID tenantId, String query) {
        return tagRepository.searchByName(tenantId, query);
    }

    /**
     * Get most popular tags.
     */
    @Transactional(readOnly = true)
    public List<Tag> getPopularTags(UUID tenantId, int limit) {
        return tagRepository.findTopByUsage(tenantId, PageRequest.of(0, limit));
    }

    /**
     * Update a tag.
     */
    public Tag updateTag(UUID tagId, String name, String description, String color) {
        Tag tag = tagRepository.findActiveById(tagId)
                .orElseThrow(() -> new IllegalArgumentException("Tag not found: " + tagId));
        
        if (name != null && !name.equals(tag.getName())) {
            tag.setName(name);
            // Optionally update slug if name changes significantly
        }
        if (description != null) {
            tag.setDescription(description);
        }
        if (color != null) {
            tag.setColor(color);
        }
        
        return tagRepository.save(tag);
    }

    /**
     * Soft delete a tag.
     */
    public void deleteTag(UUID tagId) {
        Tag tag = tagRepository.findActiveById(tagId)
                .orElseThrow(() -> new IllegalArgumentException("Tag not found: " + tagId));
        tag.setDeletedAt(LocalDateTime.now());
        tagRepository.save(tag);
    }

    /**
     * Add tags to an audio file.
     */
    public void addTagsToAudio(UUID audioId, Set<UUID> tagIds) {
        Audio audio = audioRepository.findById(audioId)
                .orElseThrow(() -> new IllegalArgumentException("Audio not found: " + audioId));
        
        for (UUID tagId : tagIds) {
            if (!audioTagJoinRepository.existsByAudioIdAndTagId(audioId, tagId)) {
                Tag tag = tagRepository.findActiveById(tagId)
                        .orElseThrow(() -> new IllegalArgumentException("Tag not found: " + tagId));
                
                AudioTagJoin audioTagJoin = new AudioTagJoin();
                audioTagJoin.setId(new AudioTagJoinId(audioId, tagId));
                audioTagJoin.setAudio(audio);
                audioTagJoin.setTag(tag);
                audioTagJoinRepository.save(audioTagJoin);
                
                tagRepository.incrementUsageCount(tagId);
            }
        }
    }

    /**
     * Remove a tag from an audio file.
     */
    public void removeTagFromAudio(UUID audioId, UUID tagId) {
        AudioTagJoinId id = new AudioTagJoinId(audioId, tagId);
        if (audioTagJoinRepository.existsById(id)) {
            audioTagJoinRepository.deleteById(id);
            tagRepository.decrementUsageCount(tagId);
        }
    }

    /**
     * Set tags for an audio (replace all existing).
     */
    public void setTagsForAudio(UUID audioId, Set<UUID> tagIds) {
        Audio audio = audioRepository.findById(audioId)
                .orElseThrow(() -> new IllegalArgumentException("Audio not found: " + audioId));
        
        // Get current tags
        List<AudioTagJoin> currentTags = audioTagJoinRepository.findAllByAudioId(audioId);
        Set<UUID> currentTagIds = currentTags.stream()
                .map(at -> at.getTag().getId())
                .collect(Collectors.toSet());
        
        // Remove tags that are no longer needed
        for (AudioTagJoin audioTagJoin : currentTags) {
            if (!tagIds.contains(audioTagJoin.getTag().getId())) {
                audioTagJoinRepository.delete(audioTagJoin);
                tagRepository.decrementUsageCount(audioTagJoin.getTag().getId());
            }
        }
        
        // Add new tags
        for (UUID tagId : tagIds) {
            if (!currentTagIds.contains(tagId)) {
                Tag tag = tagRepository.findActiveById(tagId)
                        .orElseThrow(() -> new IllegalArgumentException("Tag not found: " + tagId));
                
                AudioTagJoin audioTagJoin = new AudioTagJoin();
                audioTagJoin.setId(new AudioTagJoinId(audioId, tagId));
                audioTagJoin.setAudio(audio);
                audioTagJoin.setTag(tag);
                audioTagJoinRepository.save(audioTagJoin);
                
                tagRepository.incrementUsageCount(tagId);
            }
        }
    }

    /**
     * Get tags for an audio file.
     */
    @Transactional(readOnly = true)
    public List<Tag> getTagsForAudio(UUID audioId) {
        return audioTagJoinRepository.findAllByAudioId(audioId).stream()
                .map(AudioTagJoin::getTag)
                .collect(Collectors.toList());
    }
}
