package com.healthcare.epcr.chatbot.service;

import com.healthcare.epcr.chatbot.dto.ChatRequest;
import com.healthcare.epcr.chatbot.dto.ChatResponse;
import com.healthcare.epcr.chatbot.memory.RedisChatMemory;
import com.healthcare.epcr.patient.security.PatientPrincipal;
import com.healthcare.epcr.security.session.cache.CachedAuthSession;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Slf4j
@Service
public class PatientAiService {

    private final PatientAiToolService toolService;
    private final ChatClient chatClient;

    public PatientAiService(ChatClient.Builder chatClientBuilder, PatientAiToolService toolService, RedisChatMemory chatMemory) {
        this.toolService = toolService;
        this.chatClient = chatClientBuilder
                .defaultSystem(SYSTEM_PROMPT)
                .defaultAdvisors(MessageChatMemoryAdvisor.builder(chatMemory)
                        .order(20)
                        .build())
                .build();
    }

    private static final String SYSTEM_PROMPT = """
        You are a caring and knowledgeable personal health assistant
        in a patient portal. You help patients understand their own
        health records in plain, everyday language.

        What you can do:
        - Explain the patient's conditions, medications, and allergies
        - Help them understand their vitals and what the numbers mean
        - Summarise lab results and flag anything outside the normal range
        - Show their past hospital admissions and documents on file
        - Answer general medical and health questions, clearly separating
          general education from this patient's own record

        Rules you must always follow:
        - For patient-specific answers, use only the Patient record context
          included in the current request.
        - Never invent, infer, estimate, or assume clinical values, dates,
          diagnoses, medications, allergies, admissions, lab results, document
          names, or care history.
        - If the record context does not contain the requested information,
          say that the information is not available in the records shown here.
        - Do not fill gaps from conversation memory, common patterns, or
          general medical knowledge.
        - If the patient asks about previous conversation details, answer only
          if those details are also supported by the current record context.
        - Always translate medical jargon into simple, friendly language.
        - If a value is outside the normal range, explain it calmly and clearly
          without causing alarm. Only say a value is outside range when the
          supplied context includes a reference range or explicit abnormal flag.
          Always recommend they discuss abnormal results with their doctor.
        - Never provide a diagnosis. You can explain what values or conditions
          mean, but personal medical decisions must go through their doctor.
        - Keep responses warm, concise, and reassuring.
        - Never reveal technical details like IDs, field names, or system internals.
        - For general health questions (not specific to their records),
          answer from general medical knowledge, state that it is general
          information, and do not claim it applies to this patient unless the
          record context supports it. Always recommend professional consultation
          for personal health decisions.
        - If the answer is uncertain, say what is known from the context and
          what is not known. Do not guess.
        """;

    public ChatResponse chat(ChatRequest request, Authentication auth) {
        String patientId = extractPatientId(auth);
        String userId = extractConversationUserId(auth);

        if (patientId == null || patientId.isBlank()) {
            log.warn("Chat attempt with no patientId in session | user={}", userId);
            return new ChatResponse(
                    "Please sign in through the patient portal to use the health assistant.",
                    null
            );
        }

        toolService.setPatientId(patientId);
        String conversationId = resolveConversationId(request.conversationId(), userId);
        log.info("Patient chat | user={} pid={} conv={}", userId, patientId, conversationId);

        try {
            String patientContext = buildPatientContext();
            String reply = chatClient.prompt()
                    .advisors(advisor -> advisor.param(ChatMemory.CONVERSATION_ID, conversationId))
                    .user("""
                            Use the Patient record context below as the only source for
                            patient-specific facts. If the answer is not present there,
                            say it is not available in the records shown here.

                            Patient record context:
                            %s

                            Patient question:
                            %s
                            """.formatted(patientContext, request.message()))
                    .call()
                    .content();
            return new ChatResponse(reply, conversationId);
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage() : "";
            String cls = e.getClass().getSimpleName();

            if (msg.contains("429") || msg.contains("RESOURCE_EXHAUSTED") || msg.contains("RateLimitException")) {
                log.warn("AI quota exceeded [{}] | user={} conv={} | detail: {}",
                        cls, userId, conversationId, msg.lines().findFirst().orElse(""));
                return new ChatResponse(
                        "The health assistant is temporarily unavailable due to high demand. " +
                        "Please try again in a few minutes. If the issue persists, it may take up to 24 hours to reset.",
                        conversationId
                );
            }

            if (msg.contains("401") || msg.contains("UNAUTHENTICATED") || msg.contains("invalid_api_key")) {
                log.error("AI API key invalid/missing [{}] | user={} conv={} | detail: {}",
                        cls, userId, conversationId, msg.lines().findFirst().orElse(""));
                return new ChatResponse(
                        "The health assistant is currently unavailable. Please contact support.",
                        conversationId
                );
            }

            if (msg.contains("404") || msg.contains("NOT_FOUND")) {
                log.error("AI model not found [{}] | user={} conv={} | detail: {}",
                        cls, userId, conversationId, msg.lines().findFirst().orElse(""));
                return new ChatResponse(
                        "The health assistant is currently unavailable. Please contact support.",
                        conversationId
                );
            }

            log.error("AI chat error [{}] | user={} conv={} | detail: {}",
                    cls, userId, conversationId, msg.lines().findFirst().orElse(""), e);
            return new ChatResponse(
                    "I'm having trouble right now. Please try again in a moment.",
                    conversationId
            );
        } finally {
            toolService.clearPatientId();
        }
    }

    private String buildPatientContext() {
        return """
                Health summary:
                %s

                Latest vitals:
                %s

                Lab results:
                %s

                Admissions history:
                %s

                Documents:
                %s
                """.formatted(
                toolService.getHealthSummary(),
                toolService.getLatestVitals(),
                toolService.getLabResults(),
                toolService.getAdmissionsHistory(),
                toolService.getDocumentsList()
        );
    }

    private String resolveConversationId(String provided, String userId) {
        if (provided != null && !provided.isBlank() && provided.startsWith(userId + ":")) {
            return provided;
        }
        return userId + ":" + UUID.randomUUID();
    }

    private String extractPatientId(Authentication auth) {
        if (auth == null) {
            return null;
        }
        if (auth.getPrincipal() instanceof PatientPrincipal patientPrincipal) {
            return patientPrincipal.patientId();
        }
        if (auth.getDetails() instanceof CachedAuthSession session) {
            return session.getPatientId();
        }
        return null;
    }

    private String extractConversationUserId(Authentication auth) {
        if (auth == null) {
            return "anonymous";
        }
        if (auth.getPrincipal() instanceof PatientPrincipal patientPrincipal) {
            return patientPrincipal.patientId();
        }
        return auth.getName();
    }
}
