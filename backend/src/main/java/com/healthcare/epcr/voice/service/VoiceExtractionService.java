package com.healthcare.epcr.voice.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.epcr.common.exception.AiSuggestionException;
import com.healthcare.epcr.voice.model.VoiceTranscript;
import com.healthcare.epcr.voice.repository.VoiceTranscriptRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import java.time.Duration;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class VoiceExtractionService {

    private final VoiceTranscriptRepository transcriptRepo;
    private final RestClient restClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${spring.ai.openai.api-key:}")
    private String geminiApiKey;

    @Value("${spring.ai.openai.chat.options.model:gemini-2.5-flash}")
    private String geminiModel;

    @Value("${gemini.native.base-url:https://generativelanguage.googleapis.com/v1beta}")
    private String geminiNativeBaseUrl;

    public VoiceExtractionService(VoiceTranscriptRepository transcriptRepo,
                                  RestClient.Builder restClientBuilder,
                                  @Value("${gemini.voice.read-timeout-seconds:60}") int readTimeoutSeconds,
                                  @Value("${gemini.voice.connect-timeout-seconds:5}") int connectTimeoutSeconds) {
        this.transcriptRepo = transcriptRepo;
        
        java.net.http.HttpClient httpClient = java.net.http.HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(connectTimeoutSeconds))
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(Duration.ofSeconds(readTimeoutSeconds));
        
        this.restClient = restClientBuilder.requestFactory(requestFactory).build();
    }

    public Map<String, Object> extractFields(String transcript, String recordId, String paramedicsId) {
        if (transcript == null || transcript.isBlank()) {
            throw new IllegalArgumentException("Transcript cannot be empty");
        }

        if (geminiApiKey == null || geminiApiKey.isBlank()) {
            throw new AiSuggestionException(HttpStatus.SERVICE_UNAVAILABLE,
                    "AI voice extraction is unavailable because Gemini API key is not configured");
        }

        String prompt = buildPrompt(transcript);
        String systemInstruction = "You are a specialized medical scribe AI. Extract structured parameters from the clinician speech.";

        // Build Gemini payload with JSON response constraint
        Map<String, Object> requestBody = Map.of(
                "systemInstruction", Map.of("parts", List.of(Map.of("text", systemInstruction))),
                "contents", List.of(Map.of("role", "user", "parts", List.of(Map.of("text", prompt)))),
                "generationConfig", Map.of(
                        "responseMimeType", "application/json",
                        "temperature", 0.1
                )
        );

        String url = geminiNativeBaseUrl.replaceAll("/+$", "")
                + "/models/" + geminiModel + ":generateContent?key=" + geminiApiKey;

        String rawJson = null;
        int maxAttempts = 1;
        int attempt = 0;
        long backoffMs = 1000;

        while (attempt < maxAttempts) {
            attempt++;
            try {
                Map<?, ?> response = restClient.post()
                        .uri(url)
                        .body(requestBody)
                        .retrieve()
                        .body(Map.class);
                rawJson = extractGeminiText(response);
                break;
            } catch (RestClientResponseException e) {
                log.warn("Gemini API call failed on attempt {}/{}: status={} body={}", 
                        attempt, maxAttempts, e.getStatusCode(), e.getResponseBodyAsString());
                
                boolean isTransient = e.getStatusCode().value() == 503 || e.getStatusCode().value() == 429;
                if (attempt < maxAttempts && isTransient) {
                    try {
                        Thread.sleep(backoffMs * attempt);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new AiSuggestionException(HttpStatus.INTERNAL_SERVER_ERROR, "Retry interrupted", ie);
                    }
                } else {
                    log.error("Gemini HTTP error while extracting voice fields: status={} body={}", e.getStatusCode(), e.getResponseBodyAsString());
                    throw new AiSuggestionException(HttpStatus.BAD_GATEWAY, "Gemini service failed during field extraction", e);
                }
            } catch (Exception e) {
                log.warn("Gemini call failed on attempt {}/{}: {}", attempt, maxAttempts, e.getMessage());
                if (attempt < maxAttempts) {
                    try {
                        Thread.sleep(backoffMs * attempt);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new AiSuggestionException(HttpStatus.INTERNAL_SERVER_ERROR, "Retry interrupted", ie);
                    }
                } else {
                    log.error("Gemini call failed: {}", e.getMessage(), e);
                    throw new AiSuggestionException(HttpStatus.BAD_GATEWAY, "Unable to extract voice fields", e);
                }
            }
        }

        if (rawJson == null || rawJson.isBlank()) {
            throw new AiSuggestionException(HttpStatus.BAD_GATEWAY, "Gemini returned empty transcription analysis");
        }

        try {
            // Save transcript audit log to MongoDB
            VoiceTranscript auditLog = VoiceTranscript.builder()
                    .recordId(recordId)
                    .paramedicsId(paramedicsId)
                    .transcript(transcript)
                    .extractedJson(rawJson)
                    .createdAt(LocalDateTime.now())
                    .build();
            transcriptRepo.save(auditLog);

            // Parse response to Map and attach transcript ID
            Map<String, Object> result = objectMapper.readValue(rawJson, new TypeReference<Map<String, Object>>() {});
            result.put("voiceTranscriptId", auditLog.getId());
            return result;
        } catch (Exception e) {
            log.error("Failed to parse or save voice extraction result. Raw JSON: {}", rawJson, e);
            throw new AiSuggestionException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to parse clinical extraction output", e);
        }
    }

    private String buildPrompt(String transcript) {
        return """
            Extract ePCR fields from the paramedic/doctor's speech transcript below.
            Format numbers appropriately (e.g. for vitals like SpO2 or bloodSugar, extract as numeric floats/integers).
            Return a JSON object conforming exactly to the following structure:
            
            {
              "patientName": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "patientDateOfBirth": {"value": string (YYYY-MM-DD) or null, "confidence": float between 0.0 and 1.0},
              "patientGender": {"value": string (MALE, FEMALE, OTHER) or null, "confidence": float between 0.0 and 1.0},
              "patientPhone": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "email": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "age": {"value": integer or null, "confidence": float between 0.0 and 1.0},
              "height": {"value": float or null, "confidence": float between 0.0 and 1.0},
              "weight": {"value": float or null, "confidence": float between 0.0 and 1.0},
              "bloodGroup": {"value": string (A+, A-, B+, B-, AB+, AB-, O+, O-) or null, "confidence": float between 0.0 and 1.0},
              "patientAddress": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "patientSSNLast4": {"value": string or null, "confidence": float between 0.0 and 1.0},
              
              "comorbidity": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "currentMedicines": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "allergy": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "doctor": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "surgicalHistoryString": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "primaryPhysicianName": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "primaryPhysicianContact": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "primaryPhysicianFacility": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "advanceDirectiveType": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "pregnant": {"value": boolean or null, "confidence": float between 0.0 and 1.0},
              "gestationalWeekIfPregnant": {"value": integer or null, "confidence": float between 0.0 and 1.0},
              "dnrOnFile": {"value": boolean or null, "confidence": float between 0.0 and 1.0},
              "advanceDirective": {"value": boolean or null, "confidence": float between 0.0 and 1.0},
              "smoker": {"value": boolean or null, "confidence": float between 0.0 and 1.0},
              "alcoholUse": {"value": boolean or null, "confidence": float between 0.0 and 1.0},
              "substanceUse": {"value": boolean or null, "confidence": float between 0.0 and 1.0},
              "substanceUseDetails": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "lastKnownWellDateTime": {"value": string (YYYY-MM-DDTHH:mm) or null, "confidence": float between 0.0 and 1.0},
              "lastOralIntake": {"value": string (YYYY-MM-DDTHH:mm) or null, "confidence": float between 0.0 and 1.0},
            
              "incidentDateTime": {"value": string (YYYY-MM-DDTHH:mm) or null, "confidence": float between 0.0 and 1.0},
              "incidentLocation": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "incidentType": {"value": string (GENERAL, EMERGENCY, TRAUMA, CARDIOLOGY, RESPIRATORY, NEUROLOGY, DENTIST, etc.) or null, "confidence": float between 0.0 and 1.0},
              "incidentDescription": {"value": string or null, "confidence": float between 0.0 and 1.0},
            
              "sceneType": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "numberOfPatients": {"value": integer or null, "confidence": float between 0.0 and 1.0},
              "mechanismOfInjury": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "injuryLocation": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "sceneHazards": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "weatherConditions": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "lightingConditions": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "patientAccessDifficulty": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "triageTag": {"value": string (RED, YELLOW, GREEN, BLACK) or null, "confidence": float between 0.0 and 1.0},
              "sceneLatitude": {"value": float or null, "confidence": float between 0.0 and 1.0},
              "sceneLongitude": {"value": float or null, "confidence": float between 0.0 and 1.0},
              "sceneAltitude": {"value": float or null, "confidence": float between 0.0 and 1.0},
              "sceneGeohash": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "sceneSafe": {"value": boolean or null, "confidence": float between 0.0 and 1.0},
              "traumaCall": {"value": boolean or null, "confidence": float between 0.0 and 1.0},
              "massCasualtyIncident": {"value": boolean or null, "confidence": float between 0.0 and 1.0},
              "witnessPresent": {"value": boolean or null, "confidence": float between 0.0 and 1.0},
              "witnessName": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "witnessContact": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "bystanderCPRPerformed": {"value": boolean or null, "confidence": float between 0.0 and 1.0},
              "aedUsedByBystander": {"value": boolean or null, "confidence": float between 0.0 and 1.0},
            
              "callReceivedAt": {"value": string (YYYY-MM-DDTHH:mm) or null, "confidence": float between 0.0 and 1.0},
              "dispatchedAt": {"value": string (YYYY-MM-DDTHH:mm) or null, "confidence": float between 0.0 and 1.0},
              "enRouteAt": {"value": string (YYYY-MM-DDTHH:mm) or null, "confidence": float between 0.0 and 1.0},
              "arrivedSceneAt": {"value": string (YYYY-MM-DDTHH:mm) or null, "confidence": float between 0.0 and 1.0},
              "patientContactAt": {"value": string (YYYY-MM-DDTHH:mm) or null, "confidence": float between 0.0 and 1.0},
              "departedSceneAt": {"value": string (YYYY-MM-DDTHH:mm) or null, "confidence": float between 0.0 and 1.0},
              "arrivedDestinationAt": {"value": string (YYYY-MM-DDTHH:mm) or null, "confidence": float between 0.0 and 1.0},
              "transferOfCareAt": {"value": string (YYYY-MM-DDTHH:mm) or null, "confidence": float between 0.0 and 1.0},
              "unitAvailableAt": {"value": string (YYYY-MM-DDTHH:mm) or null, "confidence": float between 0.0 and 1.0},
            
              "systolicBp": {"value": integer or null, "confidence": float between 0.0 and 1.0},
              "diastolicBp": {"value": integer or null, "confidence": float between 0.0 and 1.0},
              "pulseRate": {"value": integer or null, "confidence": float between 0.0 and 1.0},
              "heartRate": {"value": integer or null, "confidence": float between 0.0 and 1.0},
              "respirationRate": {"value": integer or null, "confidence": float between 0.0 and 1.0},
              "spo2": {"value": float or null, "confidence": float between 0.0 and 1.0},
              "temperature": {"value": float or null, "confidence": float between 0.0 and 1.0},
              "bloodSugar": {"value": float or null, "confidence": float between 0.0 and 1.0},
              "glasgowComaScale": {"value": integer or null, "confidence": float between 0.0 and 1.0},
              "hemoglobin": {"value": float or null, "confidence": float between 0.0 and 1.0},
              "complaints": {"value": string or null, "confidence": float between 0.0 and 1.0},
            
              "mentalStatus": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "ecgRhythm": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "pupilsResponse": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "skinCondition": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "primaryImpression": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "secondaryImpression": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "diagnosis": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "treatmentProvided": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "treatmentPlan": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "clinicalTag": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "airwayManaged": {"value": boolean or null, "confidence": float between 0.0 and 1.0},
              "diagnosticFindings": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "proceduresPerformed": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "medicationsAdministered": {"value": string or null, "confidence": float between 0.0 and 1.0},
            
              "destinationName": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "transportMode": {"value": string (ALS, BLS, CRITICAL_CARE, AIR, WATER, WHEELCHAIR, WALK_IN) or null, "confidence": float between 0.0 and 1.0},
              "careLevel": {"value": string (BASIC, STABLE, URGENT, CRITICAL) or null, "confidence": float between 0.0 and 1.0},
              "status": {"value": string (PENDING, ACTIVE, COMPLETED, CANCELLED) or null, "confidence": float between 0.0 and 1.0},
              "transportReason": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "refusalOfTransportReason": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "destinationFacilityId": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "destinationAddress": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "destinationType": {"value": string (HOSPITAL, CLINIC, NURSING_HOME, RESIDENCE, OTHER) or null, "confidence": float between 0.0 and 1.0},
              "receivingPhysicianName": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "receivingNurseName": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "patientConditionOnDeparture": {"value": string (STABLE, URGENT, CRITICAL) or null, "confidence": float between 0.0 and 1.0},
              "hospitalNotifiedAt": {"value": string (YYYY-MM-DDTHH:mm) or null, "confidence": float between 0.0 and 1.0},
              "hospitalNotified": {"value": boolean or null, "confidence": float between 0.0 and 1.0},
              "continuedCPRDuringTransport": {"value": boolean or null, "confidence": float between 0.0 and 1.0},
              "aedUsedDuringTransport": {"value": boolean or null, "confidence": float between 0.0 and 1.0},
              "destLatitude": {"value": float or null, "confidence": float between 0.0 and 1.0},
              "destLongitude": {"value": float or null, "confidence": float between 0.0 and 1.0},
              "destAltitude": {"value": float or null, "confidence": float between 0.0 and 1.0},
              "destGeohash": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "handoffReport": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "patientConditionOnArrival": {"value": string (CRITICAL, URGENT, STABLE) or null, "confidence": float between 0.0 and 1.0},
            
              "consentType": {"value": string (VERBAL, WRITTEN, IMPLIED, GUARDIAN, REFUSED) or null, "confidence": float between 0.0 and 1.0},
              "patientConsentObtained": {"value": boolean or null, "confidence": float between 0.0 and 1.0},
              "patientInformedOfRisks": {"value": boolean or null, "confidence": float between 0.0 and 1.0},
              "patientHasDecisionCapacity": {"value": boolean or null, "confidence": float between 0.0 and 1.0},
              "refusalOfCare": {"value": boolean or null, "confidence": float between 0.0 and 1.0},
              "refusalReason": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "refusalWitnessed": {"value": boolean or null, "confidence": float between 0.0 and 1.0},
              "witnessName": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "witnessContact": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "capacityAssessmentNotes": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "guardianConsentObtained": {"value": boolean or null, "confidence": float between 0.0 and 1.0},
              "guardianName": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "guardianRelationship": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "guardianPhone": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "patientSignatureAttachmentId": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "guardianSignatureAttachmentId": {"value": string or null, "confidence": float between 0.0 and 1.0},
              "crewSignatureAttachmentId": {"value": string or null, "confidence": float between 0.0 and 1.0}
            }
            
            Rules:
            - If a field is not explicitly mentioned or clearly implied, set "value" to null and "confidence" to 0.0.
            - Crucial Rule: Do not duplicate the patient's presenting symptom/chief complaint (e.g., "severe tooth pain") into fields like "diagnosis", "primaryImpression", "secondaryImpression", "treatmentProvided", "treatmentPlan", "proceduresPerformed", or "medicationsAdministered" unless they are explicitly mentioned as a clinical diagnosis, impression, treatment, procedure, or medication by the speaker. If they are not explicitly mentioned, leave these fields as null with a confidence of 0.0.
            - Ensure "confidence" matches how sure you are based on context.
            - "spo2" is oxygen saturation in %.
            - "bp": split systolic and diastolic blood pressure (e.g., "120 over 80" -> systolicBp=120, diastolicBp=80).
            - "incidentType" must match one of the standard categories (GENERAL, EMERGENCY, TRAUMA, CARDIOLOGY, RESPIRATORY, NEUROLOGY, DENTIST, etc.) if applicable.
            
            Speech transcript:
            \"\"\"
            """ + transcript + """
            \"\"\"
            """;
    }

    private String extractGeminiText(Map<?, ?> response) {
        if (response == null) return null;
        Object candidatesObj = response.get("candidates");
        if (!(candidatesObj instanceof List<?> candidates) || candidates.isEmpty()) return null;
        Object firstCandidate = candidates.getFirst();
        if (!(firstCandidate instanceof Map<?, ?> candidate)) return null;
        Object contentObj = candidate.get("content");
        if (!(contentObj instanceof Map<?, ?> content)) return null;
        Object partsObj = content.get("parts");
        if (!(partsObj instanceof List<?> parts) || parts.isEmpty()) return null;
        Object firstPart = parts.getFirst();
        if (!(firstPart instanceof Map<?, ?> part)) return null;
        Object textObj = part.get("text");
        return textObj == null ? null : String.valueOf(textObj).trim();
    }
}
