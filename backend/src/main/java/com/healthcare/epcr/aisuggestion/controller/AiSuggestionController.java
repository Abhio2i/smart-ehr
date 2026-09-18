package com.healthcare.epcr.aisuggestion.controller;

import com.healthcare.epcr.aisuggestion.dto.AiSuggestionQuestionRequest;
import com.healthcare.epcr.aisuggestion.model.AiSuggestion;
import com.healthcare.epcr.aisuggestion.model.AiSuggestionQuestionAnswer;
import com.healthcare.epcr.aisuggestion.service.AiSuggestionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/ai/suggestions")
@RequiredArgsConstructor
public class AiSuggestionController {

    private final AiSuggestionService service;

    @PostMapping("/{recordId}")
    @PreAuthorize("hasAnyRole('PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER', 'ADMIN')")
    public ResponseEntity<AiSuggestion> generate(@PathVariable String recordId,
                                                 Authentication authentication) {
        String requestedBy = authentication == null ? "unknown" : authentication.getName();
        return ResponseEntity.ok(service.generateSuggestion(recordId, requestedBy));
    }

    @GetMapping("/{recordId}")
    @PreAuthorize("hasAnyRole('PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER', 'ADMIN')")
    public ResponseEntity<List<AiSuggestion>> getByRecord(@PathVariable String recordId) {
        return ResponseEntity.ok(service.getSuggestionsForRecord(recordId));
    }

    @PostMapping("/{recordId}/ask")
    @PreAuthorize("hasAnyRole('PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER', 'ADMIN')")
    public ResponseEntity<AiSuggestionQuestionAnswer> askQuestion(@PathVariable String recordId,
                                                                  @Valid @org.springframework.web.bind.annotation.RequestBody AiSuggestionQuestionRequest request,
                                                                  Authentication authentication) {
        String requestedBy = authentication == null ? "unknown" : authentication.getName();
        return ResponseEntity.ok(service.askQuestion(recordId, request.question(), requestedBy));
    }

    @GetMapping("/{recordId}/questions")
    @PreAuthorize("hasAnyRole('PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER', 'ADMIN')")
    public ResponseEntity<List<AiSuggestionQuestionAnswer>> getQuestions(@PathVariable String recordId) {
        return ResponseEntity.ok(service.getQuestionsForRecord(recordId));
    }
}
