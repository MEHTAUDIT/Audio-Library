package com.audiolibrary.controller;

import com.audiolibrary.dto.AudioResponse;
import com.audiolibrary.service.SpeakerService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
@RequestMapping("api/v1/speaker")
public class SpeakerController {
    private final SpeakerService speakerService;

    @GetMapping("/{speaker_Id}")
    public ResponseEntity<AudioResponse.SpeakerProfileResponse> getSpeakerProfile(@PathVariable UUID speaker_Id) {
        return speakerService.getSpeaker(speaker_Id);
    }
}
