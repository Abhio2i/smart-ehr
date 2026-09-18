package com.healthcare.epcr.voice.controller;

import com.healthcare.epcr.voice.service.VoiceExtractionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/ai/voice")
@RequiredArgsConstructor
public class VoiceExtractionController {

    private final VoiceExtractionService voiceService;

    @PostMapping("/extract-epcr-fields")
    @PreAuthorize("hasAnyRole('PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER', 'ADMIN', 'MANAGER')")
    public ResponseEntity<Map<String, Object>> extractFields(@RequestBody Map<String, String> body,
                                                            Authentication authentication) {
        String transcript = body.get("transcript");
        String recordId = body.get("recordId");
        String paramedicsId = authentication == null ? "unknown" : authentication.getName();

        Map<String, Object> extracted = voiceService.extractFields(transcript, recordId, paramedicsId);
        return ResponseEntity.ok(extracted);
    }
}
