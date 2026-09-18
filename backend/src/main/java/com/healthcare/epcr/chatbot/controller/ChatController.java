package com.healthcare.epcr.chatbot.controller;

import com.healthcare.epcr.chatbot.dto.ChatRequest;
import com.healthcare.epcr.chatbot.dto.ChatResponse;
import com.healthcare.epcr.chatbot.memory.RedisChatMemory;
import com.healthcare.epcr.chatbot.service.PatientAiService;
import com.healthcare.epcr.patient.security.PatientPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final PatientAiService aiService;
    private final RedisChatMemory chatMemory;

    @PostMapping("/message")
    public ResponseEntity<ChatResponse> message(
            @Valid @RequestBody ChatRequest request,
            Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(aiService.chat(request, authentication));
    }

    @DeleteMapping("/conversation/{conversationId}")
    public ResponseEntity<Void> clearConversation(
            @PathVariable String conversationId,
            Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(403).build();
        }
        String userId = currentUserId(authentication);
        if (!conversationId.startsWith(userId + ":")) {
            return ResponseEntity.status(403).build();
        }
        chatMemory.clear(conversationId);
        return ResponseEntity.noContent().build();
    }

    private String currentUserId(Authentication authentication) {
        if (authentication == null) {
            return "";
        }
        if (authentication.getPrincipal() instanceof PatientPrincipal patientPrincipal) {
            return patientPrincipal.patientId();
        }
        return authentication.getName();
    }
}
