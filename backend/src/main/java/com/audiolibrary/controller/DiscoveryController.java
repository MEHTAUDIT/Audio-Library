package com.audiolibrary.controller;

import com.audiolibrary.dto.AudioResponse;
import com.audiolibrary.entity.Audio;
import com.audiolibrary.entity.User;
import com.audiolibrary.repository.AudioRepository;
import com.audiolibrary.repository.ListeningHistoryRepository;
import com.audiolibrary.repository.UserFavoriteAudioJoinRepository;
import com.audiolibrary.repository.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/discovery")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Discovery", description = "Audio discovery: trending, recommendations, topics")
public class DiscoveryController {

    private final AudioRepository audioRepository;
    private final ListeningHistoryRepository historyRepository;
    private final UserFavoriteAudioJoinRepository favoriteRepository;
    private final UserRepository userRepository;

    @Operation(summary = "Get trending audio", description = "Get popular audio based on play count and favorites. Public endpoint.")
    @GetMapping("/trending")
    @PreAuthorize("permitAll()")
    public ResponseEntity<List<AudioResponse>> getTrending(
            @RequestParam(defaultValue = "10") int limit) {
        
        // Get published audio sorted by a combination of play count and recency
        List<Audio> publishedAudio = audioRepository.findByStatusAndDeletedAtIsNull(Audio.Status.PUBLISHED);
        
        // Calculate trending score based on play count
        List<AudioWithScore> scored = publishedAudio.stream()
                .map(audio -> {
                    long playCount = historyRepository.countByAudioId(audio.getId());
                    long favoriteCount = favoriteRepository.countByAudioId(audio.getId());
                    // Simple trending score: plays + (favorites * 2)
                    double score = playCount + (favoriteCount * 2);
                    return new AudioWithScore(audio, score);
                })
                .sorted((a, b) -> Double.compare(b.score, a.score))
                .limit(limit)
                .collect(Collectors.toList());
        
        List<AudioResponse> result = scored.stream()
                .map(s -> AudioResponse.fromEntity(s.audio))
                .collect(Collectors.toList());
        
        return ResponseEntity.ok(result);
    }

    @Operation(summary = "Get topics", description = "Get all unique topics with audio counts. Public endpoint.")
    @GetMapping("/topics")
    @PreAuthorize("permitAll()")
    public ResponseEntity<List<Map<String, Object>>> getTopics() {
        List<Audio> publishedAudio = audioRepository.findByStatusAndDeletedAtIsNull(Audio.Status.PUBLISHED);
        
        Map<String, Long> topicCounts = publishedAudio.stream()
                .filter(a -> a.getTopic() != null && !a.getTopic().isBlank())
                .collect(Collectors.groupingBy(Audio::getTopic, Collectors.counting()));
        
        List<Map<String, Object>> topics = topicCounts.entrySet().stream()
                .map(e -> {
                    Map<String, Object> topic = new HashMap<>();
                    topic.put("name", e.getKey());
                    topic.put("count", e.getValue());
                    return topic;
                })
                .sorted((a, b) -> Long.compare((Long) b.get("count"), (Long) a.get("count")))
                .collect(Collectors.toList());
        
        return ResponseEntity.ok(topics);
    }

    @Operation(summary = "Get audio by topic", description = "Get all published audio for a specific topic. Public endpoint.")
    @GetMapping("/topics/{topic}")
    @PreAuthorize("permitAll()")
    public ResponseEntity<List<AudioResponse>> getAudioByTopic(@PathVariable String topic) {
        List<Audio> audio = audioRepository.findByStatusAndDeletedAtIsNull(Audio.Status.PUBLISHED).stream()
                .filter(a -> topic.equalsIgnoreCase(a.getTopic()))
                .collect(Collectors.toList());
        
        List<AudioResponse> result = audio.stream()
                .map(AudioResponse::fromEntity)
                .collect(Collectors.toList());
        
        return ResponseEntity.ok(result);
    }

    @Operation(summary = "Get recommendations", description = "Get personalized recommendations for the user. Returns trending for anonymous users. Public endpoint.")
    @GetMapping("/recommendations")
    @PreAuthorize("permitAll()")
    public ResponseEntity<List<AudioResponse>> getRecommendations(
            @RequestParam(defaultValue = "10") int limit,
            @AuthenticationPrincipal UserDetails userDetails) {
        
        if (userDetails == null) {
            // For anonymous users, return trending
            return getTrending(limit);
        }
        
        User user = userRepository.findByEmail(userDetails.getUsername()).orElse(null);
        if (user == null) {
            return getTrending(limit);
        }
        
        UUID userId = user.getId();
        
        // Get user's listened topics
        List<Audio> listenedAudio = historyRepository.findByUserIdOrderByStartedAtDesc(userId).stream()
                .map(h -> h.getAudio())
                .collect(Collectors.toList());
        
        Set<String> preferredTopics = listenedAudio.stream()
                .map(Audio::getTopic)
                .filter(t -> t != null && !t.isBlank())
                .collect(Collectors.toSet());
        
        Set<UUID> listenedIds = listenedAudio.stream()
                .map(Audio::getId)
                .collect(Collectors.toSet());
        
        // Recommend audio in preferred topics that user hasn't listened to
        List<Audio> recommendations = audioRepository.findByStatusAndDeletedAtIsNull(Audio.Status.PUBLISHED).stream()
                .filter(a -> !listenedIds.contains(a.getId()))
                .filter(a -> preferredTopics.isEmpty() || preferredTopics.contains(a.getTopic()))
                .limit(limit)
                .collect(Collectors.toList());
        
        // If not enough recommendations, add trending
        if (recommendations.size() < limit) {
            List<Audio> trending = audioRepository.findByStatusAndDeletedAtIsNull(Audio.Status.PUBLISHED).stream()
                    .filter(a -> !listenedIds.contains(a.getId()))
                    .filter(a -> !recommendations.contains(a))
                    .limit(limit - recommendations.size())
                    .collect(Collectors.toList());
            recommendations.addAll(trending);
        }
        
        List<AudioResponse> result = recommendations.stream()
                .map(AudioResponse::fromEntity)
                .collect(Collectors.toList());
        
        return ResponseEntity.ok(result);
    }

    private static class AudioWithScore {
        Audio audio;
        double score;
        
        AudioWithScore(Audio audio, double score) {
            this.audio = audio;
            this.score = score;
        }
    }
}
