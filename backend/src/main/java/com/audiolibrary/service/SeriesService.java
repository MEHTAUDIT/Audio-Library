package com.audiolibrary.service;

import com.audiolibrary.dto.AudioResponse;
import com.audiolibrary.dto.SeriesRequest;
import com.audiolibrary.dto.SeriesResponse;
import com.audiolibrary.entity.Audio;
import com.audiolibrary.entity.Series;
import com.audiolibrary.repository.AudioRepository;
import com.audiolibrary.repository.SeriesRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SeriesService {

    private final SeriesRepository seriesRepository;
    private final AudioRepository audioRepository;

    @Transactional
    public SeriesResponse createSeries(SeriesRequest request, UUID tenantId) {
        Series series = new Series();
        series.setName(request.getName());
        series.setDescription(request.getDescription());
        series.setSpeakerId(request.getSpeakerId());
        series.setCoverImageUrl(request.getCoverImageUrl());
        series.setTenantId(tenantId);

        Series saved = seriesRepository.save(series);
        log.info("Created series: id={} name='{}' tenant={}", saved.getId(), saved.getName(), tenantId);

        return buildResponse(saved);
    }

    @Transactional
    public SeriesResponse updateSeries(UUID id, SeriesRequest request) {
        Series series = seriesRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new RuntimeException("Series not found: " + id));

        if (request.getName() != null) series.setName(request.getName());
        if (request.getDescription() != null) series.setDescription(request.getDescription());
        if (request.getSpeakerId() != null) series.setSpeakerId(request.getSpeakerId());
        if (request.getCoverImageUrl() != null) series.setCoverImageUrl(request.getCoverImageUrl());

        Series saved = seriesRepository.save(series);
        log.info("Updated series: id={} name='{}'", saved.getId(), saved.getName());

        return buildResponse(saved);
    }

    @Transactional
    public void deleteSeries(UUID id) {
        Series series = seriesRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new RuntimeException("Series not found: " + id));

        series.softDelete();
        seriesRepository.save(series);

        // Unlink all audio from this series (don't delete the audio)
        List<Audio> seriesAudio = audioRepository.findBySeriesIdAndDeletedAtIsNullOrderBySeriesOrderAsc(id);
        for (Audio audio : seriesAudio) {
            audio.setSeriesId(null);
            audio.setSeriesOrder(0);
        }
        audioRepository.saveAll(seriesAudio);

        log.info("Deleted series: id={} name='{}', unlinked {} audio items",
                id, series.getName(), seriesAudio.size());
    }

    public SeriesResponse getSeriesById(UUID id) {
        Series series = seriesRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new RuntimeException("Series not found: " + id));

        SeriesResponse response = buildResponse(series);

        // Include ordered audio items for detail view
        List<Audio> audioItems = audioRepository.findBySeriesIdAndDeletedAtIsNullOrderBySeriesOrderAsc(id);
        response.setAudioItems(audioItems.stream().map(AudioResponse::fromEntity).toList());

        return response;
    }

    public List<SeriesResponse> getAllSeries(UUID tenantId) {
        return seriesRepository.findByTenantIdAndDeletedAtIsNullOrderByNameAsc(tenantId).stream()
                .map(this::buildResponse)
                .toList();
    }

    public List<SeriesResponse> getPublishedSeries(UUID tenantId) {
        return seriesRepository.findPublishedSeries(tenantId).stream()
                .map(this::buildResponse)
                .toList();
    }

    public SeriesResponse getPublishedSeriesById(UUID id) {
        Series series = seriesRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new RuntimeException("Series not found: " + id));

        SeriesResponse response = buildResponse(series);

        // Only include published audio
        List<Audio> published = audioRepository.findBySeriesIdAndDeletedAtIsNullOrderBySeriesOrderAsc(id)
                .stream()
                .filter(a -> a.getStatus() == Audio.Status.PUBLISHED)
                .toList();
        response.setAudioItems(published.stream().map(AudioResponse::fromEntity).toList());
        response.setAudioCount(published.size());

        return response;
    }

    @Transactional
    public void addAudioToSeries(UUID seriesId, UUID audioId, Integer order) {
        Series series = seriesRepository.findByIdAndDeletedAtIsNull(seriesId)
                .orElseThrow(() -> new RuntimeException("Series not found: " + seriesId));

        Audio audio = audioRepository.findById(audioId)
                .orElseThrow(() -> new RuntimeException("Audio not found: " + audioId));

        // Auto-assign order if not provided
        if (order == null) {
            int maxOrder = audioRepository.findBySeriesIdAndDeletedAtIsNullOrderBySeriesOrderAsc(seriesId)
                    .stream()
                    .mapToInt(a -> a.getSeriesOrder() != null ? a.getSeriesOrder() : 0)
                    .max()
                    .orElse(0);
            order = maxOrder + 1;
        }

        audio.setSeriesId(seriesId);
        audio.setSeriesOrder(order);
        audioRepository.save(audio);

        log.info("Added audio {} to series {} at position {}", audioId, series.getName(), order);
    }

    @Transactional
    public void removeAudioFromSeries(UUID audioId) {
        Audio audio = audioRepository.findById(audioId)
                .orElseThrow(() -> new RuntimeException("Audio not found: " + audioId));

        UUID oldSeriesId = audio.getSeriesId();
        audio.setSeriesId(null);
        audio.setSeriesOrder(0);
        audioRepository.save(audio);

        log.info("Removed audio {} from series {}", audioId, oldSeriesId);
    }

    @Transactional
    public void reorderSeriesAudio(UUID seriesId, List<UUID> audioIds) {
        seriesRepository.findByIdAndDeletedAtIsNull(seriesId)
                .orElseThrow(() -> new RuntimeException("Series not found: " + seriesId));

        List<Audio> seriesAudio = audioRepository.findBySeriesIdAndDeletedAtIsNullOrderBySeriesOrderAsc(seriesId);

        Map<UUID, Audio> audioMap = seriesAudio.stream()
                .collect(Collectors.toMap(Audio::getId, a -> a));

        // Validate + assign new order in memory
        for (int i = 0; i < audioIds.size(); i++) {
            UUID audioId = audioIds.get(i);
            Audio audio = audioMap.get(audioId);

            if (audio == null) {
                throw new RuntimeException("Audio " + audioId + " not found in series " + seriesId);
            }

            audio.setSeriesOrder(i + 1);
        }

        audioRepository.saveAll(seriesAudio);

        log.info("Reordered {} items in series {}", audioIds.size(), seriesId);
    }

    /**
     * Find an existing series by name, or create a new one.
     * Used by BulkImportService during folder-based import.
     */
    @Transactional
    public Series findOrCreateSeries(String name, UUID tenantId) {
        return seriesRepository.findByNameAndTenantIdAndDeletedAtIsNull(name, tenantId)
                .orElseGet(() -> {
                    Series series = new Series();
                    series.setName(name);
                    series.setTenantId(tenantId);
                    Series saved = seriesRepository.save(series);
                    log.info("Auto-created series: id={} name='{}' tenant={}", saved.getId(), name, tenantId);
                    return saved;
                });
    }

    private SeriesResponse buildResponse(Series series) {
        List<Audio> audioItems = audioRepository.findBySeriesIdAndDeletedAtIsNullOrderBySeriesOrderAsc(series.getId());

        long totalDuration = audioItems.stream()
                .mapToLong(a -> a.getDurationSeconds() != null ? a.getDurationSeconds() : 0)
                .sum();

        return SeriesResponse.builder()
                .id(series.getId())
                .name(series.getName())
                .description(series.getDescription())
                .coverImageUrl(series.getCoverImageUrl())
                .speakerId(series.getSpeakerId())
                .speakerName(series.getSpeaker() != null ? series.getSpeaker().getName() : null)
                .audioCount(audioItems.size())
                .totalDurationSeconds(totalDuration)
                .createdAt(series.getCreatedAt())
                .updatedAt(series.getUpdatedAt())
                .build();
    }
}