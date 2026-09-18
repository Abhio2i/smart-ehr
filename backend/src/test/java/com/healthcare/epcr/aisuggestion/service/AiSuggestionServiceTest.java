package com.healthcare.epcr.aisuggestion.service;

import com.healthcare.epcr.aisuggestion.model.AiSuggestion;
import com.healthcare.epcr.aisuggestion.model.AiSuggestionQuestionAnswer;
import com.healthcare.epcr.aisuggestion.repository.AiSuggestionRepository;
import com.healthcare.epcr.aisuggestion.repository.AiSuggestionQuestionAnswerRepository;
import com.healthcare.epcr.common.exception.AiSuggestionException;
import com.healthcare.epcr.config.SupabaseStorageService;
import com.healthcare.epcr.epcr.model.PatientCareRecord;
import com.healthcare.epcr.epcr.repository.PatientCareRecordRepository;
import com.healthcare.epcr.patienthistory.dto.PatientHistorySummaryDTO;
import com.healthcare.epcr.patienthistory.model.PatientDocument;
import com.healthcare.epcr.patienthistory.service.PatientHistoryService;
import com.healthcare.epcr.security.AccessControlService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AiSuggestionServiceTest {

    @Mock
    private PatientCareRecordRepository epcrRepo;
    @Mock
    private PatientHistoryService patientHistoryService;
    @Mock
    private SupabaseStorageService supabaseStorageService;
    @Mock
    private AiSuggestionRepository suggestionRepo;
    @Mock
    private AiSuggestionQuestionAnswerRepository questionAnswerRepo;
    @Mock
    private AccessControlService accessControlService;
    @Mock
    private RestClient.Builder restClientBuilder;
    @Mock
    private RestClient restClient;
    @Mock
    private RestClient.RequestBodyUriSpec requestBodyUriSpec;
    @Mock
    private RestClient.RequestBodySpec requestBodySpec;
    @Mock
    private RestClient.ResponseSpec responseSpec;

    private AiSuggestionService aiSuggestionService;

    @BeforeEach
    void setUp() {
        when(restClientBuilder.build()).thenReturn(restClient);
        aiSuggestionService = new AiSuggestionService(
                epcrRepo,
                patientHistoryService,
                supabaseStorageService,
                suggestionRepo,
                questionAnswerRepo,
                accessControlService,
                restClientBuilder
        );
        // Inject values
        ReflectionTestUtils.setField(aiSuggestionService, "cooldownMinutes", 5L);
        ReflectionTestUtils.setField(aiSuggestionService, "maxAttachments", 10);
        ReflectionTestUtils.setField(aiSuggestionService, "maxAttachmentBytes", 5242880L);
        ReflectionTestUtils.setField(aiSuggestionService, "geminiApiKey", "mock-key");
        ReflectionTestUtils.setField(aiSuggestionService, "geminiModel", "gemini-2.5-flash");
        ReflectionTestUtils.setField(aiSuggestionService, "geminiNativeBaseUrl", "https://generativelanguage.googleapis.com/v1beta");
        ReflectionTestUtils.setField(aiSuggestionService, "maxOutputTokens", 2048);
        ReflectionTestUtils.setField(aiSuggestionService, "temperature", 0.2);
    }

    @Test
    void testGenerateSuggestionPayloadFormatting() {
        String recordId = "rec-1";
        String requestedBy = "user-1";

        PatientCareRecord record = new PatientCareRecord();
        record.setId(recordId);
        record.setPatientId("pat-1");
        record.setOrganizationId("org-1");

        PatientHistorySummaryDTO history = new PatientHistorySummaryDTO();
        history.setPatientId("pat-1");
        
        PatientDocument doc = new PatientDocument();
        doc.setId("doc-1");
        doc.setFileName("test.pdf");
        doc.setStoredFileUrl("supabase-path/test.pdf");
        history.setDocuments(List.of(doc));

        SupabaseStorageService.StoredFile storedFile = new SupabaseStorageService.StoredFile(
                new byte[]{1, 2, 3}, "application/pdf", 3L
        );

        when(epcrRepo.findById(recordId)).thenReturn(Optional.of(record));
        when(suggestionRepo.existsByRecordIdAndCreatedAtAfter(eq(recordId), any())).thenReturn(false);
        when(patientHistoryService.getSummary("pat-1")).thenReturn(history);
        when(supabaseStorageService.downloadFile("supabase-path/test.pdf")).thenReturn(storedFile);
        when(suggestionRepo.findByRecordIdOrderByCreatedAtDesc(recordId)).thenReturn(new ArrayList<>());
        when(questionAnswerRepo.findByRecordIdOrderByCreatedAtDesc(recordId)).thenReturn(new ArrayList<>());

        when(restClient.post()).thenReturn(requestBodyUriSpec);
        when(requestBodyUriSpec.uri(anyString())).thenReturn(requestBodySpec);
        when(requestBodySpec.body(any(Map.class))).thenReturn(requestBodySpec);
        when(requestBodySpec.retrieve()).thenReturn(responseSpec);

        // Mock response body from Gemini API
        Map<String, Object> geminiResponse = Map.of(
                "candidates", List.of(
                        Map.of("content", Map.of(
                                "parts", List.of(
                                        Map.of("text", "RISK LEVEL: LOW\n\nCLINICAL SUMMARY:\nPatient is stable.\n\nFINDINGS:\n- Vitals normal\n\nCLINICAL CONCERNS:\n- None\n\nRECOMMENDATIONS:\n- Follow up\n\nRECOMMENDED PLAN:\n- Monitoring\n\nMISSING DATA:\n- None")
                                )
                        ))
                )
        );
        when(responseSpec.body(Map.class)).thenReturn(geminiResponse);
        when(suggestionRepo.save(any(AiSuggestion.class))).thenAnswer(i -> i.getArgument(0));

        AiSuggestion result = aiSuggestionService.generateSuggestion(recordId, requestedBy);

        assertNotNull(result);
        assertEquals("LOW", result.getRiskLevel());

        // Verify the payload keys are camelCase (inlineData and mimeType)
        ArgumentCaptor<Map> bodyCaptor = ArgumentCaptor.forClass(Map.class);
        verify(requestBodySpec).body(bodyCaptor.capture());
        Map<?, ?> capturedBody = bodyCaptor.getValue();

        assertNotNull(capturedBody);
        List<?> contents = (List<?>) capturedBody.get("contents");
        assertNotNull(contents);
        assertEquals(1, contents.size());
        Map<?, ?> userContent = (Map<?, ?>) contents.get(0);
        List<?> parts = (List<?>) userContent.get("parts");
        assertNotNull(parts);
        
        // Parts should have: prompt, document label text, and inlineData blob
        assertEquals(3, parts.size());
        
        Map<?, ?> inlineDataPart = (Map<?, ?>) parts.get(2);
        assertTrue(inlineDataPart.containsKey("inlineData"), "Payload must contain inlineData, not inline_data");
        assertFalse(inlineDataPart.containsKey("inline_data"), "Payload must not contain inline_data");

        Map<?, ?> inlineData = (Map<?, ?>) inlineDataPart.get("inlineData");
        assertNotNull(inlineData);
        assertEquals("application/pdf", inlineData.get("mimeType"), "mimeType should be camelCase");
        assertFalse(inlineData.containsKey("mime_type"), "Payload must not contain mime_type");
    }

    @Test
    void generateSuggestionMapsGeminiUnsupportedLocationToServiceUnavailable() {
        String recordId = "rec-1";
        String requestedBy = "user-1";

        PatientCareRecord record = new PatientCareRecord();
        record.setId(recordId);
        record.setPatientId("pat-1");
        record.setOrganizationId("org-1");

        PatientHistorySummaryDTO history = new PatientHistorySummaryDTO();
        history.setPatientId("pat-1");

        when(epcrRepo.findById(recordId)).thenReturn(Optional.of(record));
        when(suggestionRepo.existsByRecordIdAndCreatedAtAfter(eq(recordId), any())).thenReturn(false);
        when(patientHistoryService.getSummary("pat-1")).thenReturn(history);
        when(suggestionRepo.findByRecordIdOrderByCreatedAtDesc(recordId)).thenReturn(new ArrayList<>());
        when(questionAnswerRepo.findByRecordIdOrderByCreatedAtDesc(recordId)).thenReturn(new ArrayList<>());

        when(restClient.post()).thenReturn(requestBodyUriSpec);
        when(requestBodyUriSpec.uri(anyString())).thenReturn(requestBodySpec);
        when(requestBodySpec.body(any(Map.class))).thenReturn(requestBodySpec);
        when(requestBodySpec.retrieve()).thenReturn(responseSpec);

        String responseBody = """
                {
                  "error": {
                    "code": 400,
                    "message": "User location is not supported for the API use.",
                    "status": "FAILED_PRECONDITION"
                  }
                }
                """;
        when(responseSpec.body(Map.class)).thenThrow(new HttpClientErrorException(
                HttpStatus.BAD_REQUEST,
                "Bad Request",
                responseBody.getBytes(StandardCharsets.UTF_8),
                StandardCharsets.UTF_8
        ));

        AiSuggestionException exception = assertThrows(
                AiSuggestionException.class,
                () -> aiSuggestionService.generateSuggestion(recordId, requestedBy)
        );

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, exception.getStatus());
        assertTrue(exception.getMessage().contains("deployment location"));
    }
}
