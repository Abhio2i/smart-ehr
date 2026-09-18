package com.healthcare.epcr.aisuggestion.service;

import com.healthcare.epcr.aisuggestion.model.AiSuggestion;
import com.healthcare.epcr.aisuggestion.model.AiSuggestionQuestionAnswer;
import com.healthcare.epcr.aisuggestion.repository.AiSuggestionRepository;
import com.healthcare.epcr.aisuggestion.repository.AiSuggestionQuestionAnswerRepository;
import com.healthcare.epcr.common.exception.AiSuggestionException;
import com.healthcare.epcr.common.exception.ResourceNotFoundException;
import com.healthcare.epcr.config.SupabaseStorageService;
import com.healthcare.epcr.epcr.model.PatientCareRecord;
import com.healthcare.epcr.epcr.repository.PatientCareRecordRepository;
import com.healthcare.epcr.patienthistory.dto.PatientHistorySummaryDTO;
import com.healthcare.epcr.patienthistory.model.PatientAdmission;
import com.healthcare.epcr.patienthistory.model.PatientCondition;
import com.healthcare.epcr.patienthistory.model.PatientDocument;
import com.healthcare.epcr.patienthistory.model.PatientEncounter;
import com.healthcare.epcr.patienthistory.model.PatientLabResult;
import com.healthcare.epcr.patienthistory.model.PatientMedication;
import com.healthcare.epcr.patienthistory.model.PatientVital;
import com.healthcare.epcr.patienthistory.service.PatientHistoryService;
import com.healthcare.epcr.security.AccessControlService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
public class AiSuggestionService {

    private static final String MODEL_PROVIDER = "gemini";
    private static final Pattern SECTION_HEADER_PATTERN = Pattern.compile(
            "^\\s*[A-Z][A-Z /-]+:\\s*$",
            Pattern.MULTILINE
    );

    private final PatientCareRecordRepository epcrRepo;
    private final PatientHistoryService patientHistoryService;
    private final SupabaseStorageService supabaseStorageService;
    private final AiSuggestionRepository suggestionRepo;
    private final AiSuggestionQuestionAnswerRepository questionAnswerRepo;
    private final AccessControlService accessControlService;
    private final RestClient restClient;

    @Value("${ai.suggestions.cooldown-minutes:5}")
    private long cooldownMinutes;

    @Value("${ai.suggestions.max-attachments:10}")
    private int maxAttachments;

    @Value("${ai.suggestions.max-attachment-bytes:5242880}")
    private long maxAttachmentBytes;

    @Value("${spring.ai.openai.api-key:}")
    private String geminiApiKey;

    @Value("${spring.ai.openai.chat.options.model:gemini-2.5-flash}")
    private String geminiModel;

    @Value("${gemini.native.base-url:https://generativelanguage.googleapis.com/v1beta}")
    private String geminiNativeBaseUrl;

    @Value("${spring.ai.openai.chat.options.max-tokens:8192}")
    private int maxOutputTokens;

    @Value("${spring.ai.openai.chat.options.temperature:0.2}")
    private double temperature;

    public AiSuggestionService(PatientCareRecordRepository epcrRepo,
                               PatientHistoryService patientHistoryService,
                               SupabaseStorageService supabaseStorageService,
                               AiSuggestionRepository suggestionRepo,
                               AiSuggestionQuestionAnswerRepository questionAnswerRepo,
                               AccessControlService accessControlService,
                               RestClient.Builder restClientBuilder) {
        this.epcrRepo = epcrRepo;
        this.patientHistoryService = patientHistoryService;
        this.supabaseStorageService = supabaseStorageService;
        this.suggestionRepo = suggestionRepo;
        this.questionAnswerRepo = questionAnswerRepo;
        this.accessControlService = accessControlService;
        this.restClient = restClientBuilder.build();
    }

    public AiSuggestion generateSuggestion(String recordId, String requestedBy) {
        PatientCareRecord record = epcrRepo.findById(recordId)
                .orElseThrow(() -> new ResourceNotFoundException("Record not found: " + recordId));
        accessControlService.assertOrganizationAccess(record.getOrganizationId());

        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(cooldownMinutes);
        if (suggestionRepo.existsByRecordIdAndCreatedAtAfter(recordId, cutoff)) {
            return suggestionRepo.findFirstByRecordIdOrderByCreatedAtDesc(recordId)
                    .orElseThrow(() -> new IllegalStateException("Recent AI suggestion could not be loaded"));
        }

        PatientHistorySummaryDTO history = patientHistoryService.getSummary(record.getPatientId());
        List<DocumentAttachment> attachments = loadSupportedAttachments(history.getDocuments());
        List<AiSuggestion> previousSuggestions = suggestionRepo.findByRecordIdOrderByCreatedAtDesc(recordId);
        List<AiSuggestionQuestionAnswer> previousQuestions = questionAnswerRepo.findByRecordIdOrderByCreatedAtDesc(recordId);
        String prompt = buildClinicalPrompt(record, history, attachments, previousSuggestions, previousQuestions);
        String rawText = callGemini(prompt, attachments, buildSystemPrompt(), 0.0);

        AiSuggestion suggestion = AiSuggestion.builder()
                .recordId(recordId)
                .patientId(record.getPatientId())
                .organizationId(record.getOrganizationId())
                .requestedBy(requestedBy)
                .modelProvider(MODEL_PROVIDER + ":" + geminiModel)
                .rawResponse(rawText)
                .clinicalSummary(parseTextSection(rawText, "CLINICAL SUMMARY"))
                .findings(parseBulletSection(rawText, "FINDINGS"))
                .clinicalConcerns(parseBulletSection(rawText, "CLINICAL CONCERNS"))
                .recommendations(parseBulletSection(rawText, "RECOMMENDATIONS"))
                .recommendedPlan(parseBulletSection(rawText, "RECOMMENDED PLAN"))
                .missingData(parseBulletSection(rawText, "MISSING DATA"))
                .attachmentsAnalyzed(attachments.stream().map(DocumentAttachment::label).toList())
                .riskLevel(parseRiskLevel(rawText))
                .createdAt(LocalDateTime.now())
                .build();

        return suggestionRepo.save(suggestion);
    }

    public List<AiSuggestion> getSuggestionsForRecord(String recordId) {
        PatientCareRecord record = epcrRepo.findById(recordId)
                .orElseThrow(() -> new ResourceNotFoundException("Record not found: " + recordId));
        accessControlService.assertOrganizationAccess(record.getOrganizationId());
        return suggestionRepo.findByRecordIdOrderByCreatedAtDesc(recordId);
    }

    public AiSuggestionQuestionAnswer askQuestion(String recordId, String question, String requestedBy) {
        if (question == null || question.isBlank()) {
            throw new IllegalArgumentException("question is required");
        }
        PatientCareRecord record = epcrRepo.findById(recordId)
                .orElseThrow(() -> new ResourceNotFoundException("Record not found: " + recordId));
        accessControlService.assertOrganizationAccess(record.getOrganizationId());

        PatientHistorySummaryDTO history = patientHistoryService.getSummary(record.getPatientId());
        List<DocumentAttachment> attachments = loadSupportedAttachments(history.getDocuments());
        List<AiSuggestion> previousSuggestions = suggestionRepo.findByRecordIdOrderByCreatedAtDesc(recordId);
        List<AiSuggestionQuestionAnswer> previousQuestions = questionAnswerRepo.findByRecordIdOrderByCreatedAtDesc(recordId);
        String prompt = buildQuestionPrompt(record, history, attachments, question, previousSuggestions, previousQuestions);
        String rawAnswer = callGemini(prompt, attachments, buildQuestionSystemPrompt(), 0.0);

        return questionAnswerRepo.save(AiSuggestionQuestionAnswer.builder()
                .recordId(recordId)
                .patientId(record.getPatientId())
                .organizationId(record.getOrganizationId())
                .requestedBy(requestedBy)
                .modelProvider(MODEL_PROVIDER + ":" + geminiModel)
                .question(question.trim())
                .answer(parseQaTextSection(rawAnswer, "QA ANSWER"))
                .evidenceFromCase(parseQaBulletSection(rawAnswer, "QA EVIDENCE FROM THIS CASE"))
                .clinicalReasoning(parseQaBulletSection(rawAnswer, "QA CLINICAL REASONING"))
                .recommendedNextStep(parseQaBulletSection(rawAnswer, "QA RECOMMENDED NEXT STEP"))
                .missingData(parseQaBulletSection(rawAnswer, "QA MISSING DATA"))
                .attachmentsAnalyzed(attachments.stream().map(DocumentAttachment::label).toList())
                .createdAt(LocalDateTime.now())
                .build());
    }

    public List<AiSuggestionQuestionAnswer> getQuestionsForRecord(String recordId) {
        PatientCareRecord record = epcrRepo.findById(recordId)
                .orElseThrow(() -> new ResourceNotFoundException("Record not found: " + recordId));
        accessControlService.assertOrganizationAccess(record.getOrganizationId());
        return questionAnswerRepo.findByRecordIdOrderByCreatedAtDesc(recordId);
    }

    private String callGemini(String prompt, List<DocumentAttachment> attachments, String systemPrompt, double requestTemperature) {
        if (geminiApiKey == null || geminiApiKey.isBlank()) {
            throw new AiSuggestionException(HttpStatus.SERVICE_UNAVAILABLE,
                    "AI suggestions are unavailable because Gemini API key is not configured");
        }

        List<Map<String, Object>> parts = new ArrayList<>();
        parts.add(Map.of("text", prompt));
        for (DocumentAttachment attachment : attachments) {
            parts.add(Map.of("text", "Analyze attached clinical document: " + attachment.label()));
            parts.add(Map.of("inlineData", Map.of(
                    "mimeType", attachment.mimeType(),
                    "data", attachment.base64Data()
            )));
        }

        Map<String, Object> requestBody = Map.of(
                "systemInstruction", Map.of("parts", List.of(Map.of("text", systemPrompt))),
                "contents", List.of(Map.of("role", "user", "parts", parts)),
                "generationConfig", Map.of(
                        "maxOutputTokens", maxOutputTokens,
                        "temperature", requestTemperature
                )
        );

        String url = geminiNativeBaseUrl.replaceAll("/+$", "")
                + "/models/" + geminiModel + ":generateContent?key=" + geminiApiKey;

        try {
            Map<?, ?> response = restClient.post()
                    .uri(url)
                    .body(requestBody)
                    .retrieve()
                    .body(Map.class);
            String text = extractGeminiText(response);
            if (text == null || text.isBlank()) {
                throw new AiSuggestionException(HttpStatus.BAD_GATEWAY,
                        "Gemini returned an empty response. Please retry or reduce attached report size.");
            }
            return text;
        } catch (AiSuggestionException e) {
            throw e;
        } catch (RestClientResponseException e) {
            throw mapGeminiHttpError(e);
        } catch (RestClientException e) {
            log.error("Gemini AI suggestion network/client error: {}", e.getMessage(), e);
            throw new AiSuggestionException(HttpStatus.BAD_GATEWAY,
                    "Unable to reach Gemini right now. Please retry in a few minutes.", e);
        } catch (Exception e) {
            String detail = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
            log.error("Gemini AI suggestion call failed: {}", detail, e);
            throw new AiSuggestionException(HttpStatus.BAD_GATEWAY,
                    "Unable to generate AI suggestion from Gemini. Please retry.", e);
        }
    }

    private AiSuggestionException mapGeminiHttpError(RestClientResponseException e) {
        int statusCode = e.getStatusCode().value();
        String responseBody = e.getResponseBodyAsString();
        String detail = firstNonBlank(extractGeminiErrorMessage(responseBody), e.getStatusText(), "Gemini API error");
        log.warn("Gemini API error status={} detail={}", statusCode, detail);

        if (statusCode == 400) {
            if (isGeminiLocationUnsupportedError(detail)) {
                return new AiSuggestionException(HttpStatus.SERVICE_UNAVAILABLE,
                        "AI suggestions are unavailable because Gemini API access is not supported from this deployment location. " +
                                "Configure a supported Gemini/Vertex AI region or switch the AI provider.", e);
            }
            return new AiSuggestionException(HttpStatus.BAD_REQUEST,
                    "Gemini rejected the AI suggestion request: " + detail, e);
        }
        if (statusCode == 401 || statusCode == 403) {
            return new AiSuggestionException(HttpStatus.SERVICE_UNAVAILABLE,
                    "AI suggestions are unavailable because Gemini authentication failed: " + detail, e);
        }
        if (statusCode == 404) {
            return new AiSuggestionException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Configured Gemini model was not found or is not available: " + detail, e);
        }
        if (statusCode == 408 || statusCode == 504) {
            return new AiSuggestionException(HttpStatus.GATEWAY_TIMEOUT,
                    "Gemini timed out while generating the suggestion. Please retry.", e);
        }
        if (statusCode == 409) {
            return new AiSuggestionException(HttpStatus.CONFLICT,
                    "Gemini could not process this request right now. Please retry.", e);
        }
        if (statusCode == 429) {
            return new AiSuggestionException(HttpStatus.TOO_MANY_REQUESTS,
                    "Gemini quota or rate limit was reached. Please retry later.", e);
        }
        if (statusCode >= 500) {
            return new AiSuggestionException(HttpStatus.BAD_GATEWAY,
                    "Gemini service is temporarily unavailable. Please retry later.", e);
        }
        return new AiSuggestionException(HttpStatus.BAD_GATEWAY,
                "Gemini API error: " + detail, e);
    }

    private boolean isGeminiLocationUnsupportedError(String detail) {
        if (detail == null || detail.isBlank()) {
            return false;
        }
        String normalized = detail.toLowerCase();
        return normalized.contains("location") && normalized.contains("not supported");
    }

    private String extractGeminiErrorMessage(String responseBody) {
        if (responseBody == null || responseBody.isBlank()) {
            return null;
        }
        Matcher matcher = Pattern.compile("\"message\"\\s*:\\s*\"([^\"]+)\"").matcher(responseBody);
        return matcher.find() ? matcher.group(1) : null;
    }

    private String firstNonBlank(String... values) {
        return Arrays.stream(values)
                .filter(value -> value != null && !value.isBlank())
                .findFirst()
                .orElse("");
    }

    private String extractGeminiText(Map<?, ?> response) {
        if (response == null) {
            return "";
        }
        Object candidatesObj = response.get("candidates");
        if (!(candidatesObj instanceof List<?> candidates) || candidates.isEmpty()) {
            return "";
        }
        Object firstCandidate = candidates.getFirst();
        if (!(firstCandidate instanceof Map<?, ?> candidate)) {
            return "";
        }
        Object contentObj = candidate.get("content");
        if (!(contentObj instanceof Map<?, ?> content)) {
            return "";
        }
        Object partsObj = content.get("parts");
        if (!(partsObj instanceof List<?> parts)) {
            return "";
        }
        return parts.stream()
                .filter(Map.class::isInstance)
                .map(Map.class::cast)
                .map(part -> part.get("text"))
                .filter(Objects::nonNull)
                .map(String::valueOf)
                .collect(Collectors.joining("\n"))
                .trim();
    }

    private String buildSystemPrompt() {
        return """
                You are a clinical decision support assistant for paramedics and physicians.
                Analyze every provided item: ePCR, vitals, symptoms, findings, conditions, medications, admissions,
                encounters, lab values, document metadata, previous AI clinical suggestions/Q&A history, and attached report/image/PDF files.

                OUTPUT FORMAT RULES (strict — do NOT deviate):
                - Use ONLY plain hyphen bullets starting with "- " for all list items.
                - Do NOT use markdown bold (**text**), asterisks (*text*), tables, numbered lists, or any markdown formatting.
                - Do NOT use headers other than the section labels listed below.
                - Each section header must appear exactly as shown, on its own line, followed by a colon.
                - Each bullet must be on its own line, starting with "- ".
                - Be thorough and detailed — each section should have 3-8 bullets minimum.

                RISK LEVEL CRITERIA (apply these rules exactly — do NOT deviate based on judgment):

                Assign HIGH if ANY of the following are present:
                - Airway compromise, respiratory failure, or SpO2 < 90%
                - Systolic BP < 90 or > 180 mmHg (hemodynamic instability)
                - Heart rate < 50 or > 130 bpm (persistent)
                - GCS < 13 or altered consciousness / AVPU = P or U
                - Active chest pain with cardiac concern
                - Suspected stroke, sepsis, pulmonary embolism, or anaphylaxis
                - Active severe bleeding or trauma
                - Blood glucose < 60 or > 400 mg/dL
                - Temperature > 39.5°C or < 35°C
                - Inability to eat or drink for > 48 hours with signs of dehydration or weight loss > 5%
                - Severe, uncontrolled pain (score 8-10/10) affecting basic function
                - Active wound infection with fever, swelling, or pus
                - New or rapidly worsening symptoms in a known diabetic, cardiac, or oncology patient

                Assign MEDIUM if ANY of the following are present AND no HIGH criteria apply:
                - SpO2 88-93% with chronic lung disease (known baseline)
                - Systolic BP 90-100 or 160-180 with symptoms
                - Pain score 5-7/10 affecting daily function
                - Known chronic condition (diabetes, GERD, hypertension) with new or worsening symptoms
                - Inability to eat/drink for 24-48 hours without signs of systemic dehydration
                - Delayed care (> 2 weeks since onset) for a symptomatic condition
                - Missing key data (vitals, labs) that prevents a LOW classification
                - Condition requiring specialist referral within 48-72 hours
                - Known medication non-compliance with symptomatic impact

                Assign LOW only if ALL of the following are true:
                - Vital signs within normal range (SpO2 ≥ 94%, BP 100-159/60-99, HR 60-100, RR 12-20, Temp 36-38°C)
                - Patient is alert, oriented, and stable
                - Symptoms are mild, chronic, and well-managed
                - No acute deterioration or new high-risk concern
                - Appropriate care plan exists and is being followed

                Always respond in this exact format:

                RISK LEVEL: HIGH | MEDIUM | LOW

                CLINICAL SUMMARY:
                2-4 detailed sentences covering patient state, most important context, and clinical urgency.

                FINDINGS:
                - specific abnormal or important finding with evidence and source

                CLINICAL CONCERNS:
                - urgent concern or differential consideration (do not make a final diagnosis)

                RECOMMENDATIONS:
                - immediate actionable suggestion for paramedic or physician, tied to evidence

                RECOMMENDED PLAN:
                - practical next step: monitoring, escalation, transport, reassessment, or follow-up action

                MISSING DATA:
                - important missing clinical data that would improve assessment, or state: None obvious from provided records

                Be detailed enough for a clinician to act on immediately.
                Do not invent or assume values not present in the data.
                Do not provide a final diagnosis — support clinical decision-making only.
                """;
    }

    private String buildQuestionSystemPrompt() {
        return """
                You are a senior clinical decision support AI embedded in a hospital-grade ePCR system.
                Clinicians — doctors, paramedics, dentists, and specialists — ask you detailed questions
                about specific patients. Your answers must be comprehensive, precise, and evidence-bound.

                === CORE ACCURACY RULES ===
                - Answer ONLY from the provided ePCR data, patient history, vitals, labs, medications,
                  conditions, encounters, admissions, attached documents/images/PDFs, and prior AI analyses.
                - Cite every claim with the exact source: lab test name + value + date, vital reading + date,
                  medication name + dose, document/report name, or condition name + diagnosis date.
                - Never guess, extrapolate, or invent values not present in the supplied data.
                - Never say "yes", "safe", "cleared", or "no issue" unless the supplied evidence directly supports it.
                - If evidence is partially supportive, say: "No obvious contraindication in provided records,
                  but final clearance requires clinician review and [specific missing item]."
                - If critical evidence is absent, say exactly what is missing and why it matters.
                - Do NOT give a final diagnosis or final procedure clearance — always defer final judgment to the clinician.
                - Use plain text only. No markdown bold, italic, headers, or tables. Use "- " bullets for lists.
                - Be THOROUGH. A question about procedure suitability or drug safety requires covering ALL
                  relevant data domains: vitals, labs, medications, allergies, conditions, imaging, and history.

                === DEPTH REQUIREMENTS PER SECTION ===

                QA ANSWER: This is the PRIMARY detailed section. Write 8-12 sentences minimum.
                - Open with the definitive clinical position on the question.
                - Walk through each major relevant data domain (vitals, labs, medications, conditions,
                  imaging, allergies, history) in order of clinical importance to the question.
                - For each domain, state what the record shows AND what that means clinically for this patient.
                - Explicitly call out risk factors, contraindications, supportive findings, and uncertainties.
                - End with the single most important caveat or missing piece that would change the answer.
                This section must be complete enough that a clinician can act on it without reading any other section.

                QA EVIDENCE FROM THIS CASE: Keep this SHORT and scannable — maximum 3 concise bullets.
                Only list the 3 most important data points directly answering the question.
                Format: "- [item]: [value] ([date])"
                Do NOT repeat details that are already in QA ANSWER.

                QA CLINICAL REASONING: Minimum 5 bullet points. For each key evidence item, explain:
                - Why it is relevant to the question asked
                - How it supports OR limits the clinical answer
                - What would change the conclusion if it were different
                Example: "- HbA1c 7.2% is below the 8% threshold typically used as a contraindication for
                  elective implant surgery; healing risk is acceptable but monitoring post-op glucose is advised."

                QA RECOMMENDED NEXT STEP: Minimum 3 bullet points. Be specific and actionable:
                - State who should do what (e.g., "Physician to review", "Dentist to order", "Paramedic to monitor")
                - Include timeline or urgency where relevant (e.g., "before any procedure", "within 48 hours")
                - Reference the missing data that would improve confidence

                QA MISSING DATA: Maximum 3 bullets. Only list the most critical gaps that would change
                the clinical answer. Omit minor or academic gaps. If none: state "None obvious from provided records."

                === SPECIALITY-SPECIFIC GUIDANCE ===

                FOR DENTAL / IMPLANT / ORAL SURGERY QUESTIONS, evaluate ALL of the following explicitly:
                - Glycemic control: HbA1c (target <8% for elective implants), recent fasting/random blood glucose
                - Active infection: oral swelling, pus, fever, severe uncontrolled pain, periapical abscess on imaging
                - Imaging: CBCT, panoramic X-ray, periapical X-rays — bone quality, density, quantity, sinus proximity
                - Periodontal status: probing depth, bleeding on probing, existing bone loss
                - Medications affecting implant: bisphosphonates (MRONJ risk), anticoagulants, immunosuppressants,
                  corticosteroids, chemotherapy agents
                - Cardiovascular risk: BP, cardiac history, antiplatelet/anticoagulant use
                - Healing risk factors: smoking (doubles implant failure risk), diabetes, radiation history,
                  autoimmune conditions, immunosuppression
                - Allergies: titanium, local anesthetics, antibiotics, latex

                FOR MEDICATION / DRUG SAFETY QUESTIONS, evaluate:
                - Known allergies and cross-reactions
                - Current medications and interactions
                - Renal/hepatic function from labs
                - Contraindicated conditions (e.g., beta-blockers in asthma, NSAIDs in renal impairment)
                - Dosing suitability given patient weight, age, and comorbidities

                FOR SURGICAL / PROCEDURE SUITABILITY QUESTIONS, evaluate:
                - Cardiovascular clearance: BP, ECG findings, cardiac history
                - Bleeding risk: anticoagulants, platelet count, INR/PT/aPTT
                - Anesthetic risk: ASA classification indicators from available data
                - Infection risk: current WBC, CRP, fever, active infections
                - Metabolic stability: glucose control, electrolytes, renal/hepatic function

                OUTPUT FORMAT (exact section labels required — do NOT use any other format):

                QA ANSWER:
                [8-12 sentences. Full clinical depth — cover every relevant domain: vitals, labs, meds,
                conditions, imaging, allergies, history. Cite exact values and dates. This is the MAIN section.]

                QA EVIDENCE FROM THIS CASE:
                - [top data point: value (date)]
                - [second data point: value (date)]
                - [third data point: value (date)]

                QA CLINICAL REASONING:
                - [why each evidence item matters to this specific question]
                - [minimum 5 bullets]

                QA RECOMMENDED NEXT STEP:
                - [specific, actionable step with responsible party and timeline]
                - [minimum 3 bullets]

                QA MISSING DATA:
                - [most critical gap | why it matters]
                - [maximum 3 bullets; omit trivial gaps]
                """;
    }

    private String formatPreviousSuggestions(List<AiSuggestion> suggestions) {
        if (suggestions == null || suggestions.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        sb.append("\n=== PREVIOUS AI CLINICAL SUGGESTIONS & ANALYSES ===\n");
        List<AiSuggestion> recent = suggestions.stream().limit(3).toList();
        for (int i = 0; i < recent.size(); i++) {
            AiSuggestion s = recent.get(i);
            sb.append(String.format("Analysis #%d (Created: %s):\n", i + 1, s.getCreatedAt()));
            sb.append(String.format("- Risk Level: %s\n", s.getRiskLevel()));
            if (s.getClinicalSummary() != null && !s.getClinicalSummary().isBlank()) {
                sb.append(String.format("- Clinical Summary: %s\n", s.getClinicalSummary()));
            }
            if (s.getFindings() != null && !s.getFindings().isEmpty()) {
                sb.append("- Findings: ").append(String.join("; ", s.getFindings())).append("\n");
            }
            if (s.getClinicalConcerns() != null && !s.getClinicalConcerns().isEmpty()) {
                sb.append("- Clinical Concerns: ").append(String.join("; ", s.getClinicalConcerns())).append("\n");
            }
            if (s.getRecommendations() != null && !s.getRecommendations().isEmpty()) {
                sb.append("- Recommendations: ").append(String.join("; ", s.getRecommendations())).append("\n");
            }
            sb.append("\n");
        }
        return sb.toString();
    }

    private String formatPreviousQuestions(List<AiSuggestionQuestionAnswer> questions) {
        if (questions == null || questions.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        sb.append("\n=== PREVIOUS CLINICIAN QUESTIONS & ANSWERS ===\n");
        List<AiSuggestionQuestionAnswer> recent = questions.stream().limit(5).toList();
        for (int i = 0; i < recent.size(); i++) {
            AiSuggestionQuestionAnswer q = recent.get(i);
            sb.append(String.format("Q&A #%d (Created: %s):\n", i + 1, q.getCreatedAt()));
            sb.append(String.format("- Question: %s\n", q.getQuestion()));
            sb.append(String.format("- Answer: %s\n", q.getAnswer()));
            if (q.getEvidenceFromCase() != null && !q.getEvidenceFromCase().isEmpty()) {
                sb.append("- Evidence: ").append(String.join("; ", q.getEvidenceFromCase())).append("\n");
            }
            sb.append("\n");
        }
        return sb.toString();
    }

    private String buildClinicalPrompt(PatientCareRecord record,
                                       PatientHistorySummaryDTO history,
                                       List<DocumentAttachment> attachments,
                                       List<AiSuggestion> previousSuggestions,
                                       List<AiSuggestionQuestionAnswer> previousQuestions) {
        StringBuilder sb = new StringBuilder();
        sb.append("=== EPCR RECORD ===\n");
        appendLine(sb, "Record ID", record.getId());
        appendLine(sb, "Patient ID", record.getPatientId());
        appendLine(sb, "Organization ID", record.getOrganizationId());
        appendLine(sb, "Patient demographics", joinNonBlank(record.getAge(), record.getPatientGender(), record.getHeight(), record.getWeight(), record.getBloodGroup()));
        appendLine(sb, "Incident", joinNonBlank(record.getIncidentType(), record.getIncidentDescription()));
        appendLine(sb, "Incident date/time", record.getIncidentDateTime());
        appendLine(sb, "Incident location", record.getIncidentLocation());
        appendLine(sb, "Root vitals", rootVitals(record));
        appendLine(sb, "Legacy vitals text", record.getVitals());
        appendLine(sb, "Structured vitals", record.getStructuredVitals());
        appendLine(sb, "Complaints", record.getComplaints());
        appendLine(sb, "Structured complaints/symptoms", record.getStructuredComplaints());
        appendLine(sb, "Primary impression", record.getPrimaryImpression());
        appendLine(sb, "Secondary impression", record.getSecondaryImpression());
        appendLine(sb, "Recorded diagnosis", record.getDiagnosis());
        appendLine(sb, "Treatment provided", record.getTreatmentProvided());
        appendLine(sb, "Treatment plan", record.getTreatmentPlan());
        appendLine(sb, "Diet advice", record.getDietAdvice());
        appendLine(sb, "Clinical notes", record.getNotes());
        appendLine(sb, "Medications administered", record.getMedicationsAdministered());
        appendLine(sb, "Structured medications administered", record.getStructuredMedications());
        appendLine(sb, "Procedures performed", record.getProceduresPerformed());
        appendLine(sb, "Structured procedures", record.getStructuredProcedures());
        appendLine(sb, "Transport", record.getTransport());
        appendLine(sb, "Consent", record.getConsent());
        appendLine(sb, "Clinical data", record.getClinicalData());
        appendLine(sb, "Medical history captured in ePCR", record.getMedicalHistory());
        appendLine(sb, "Known allergy", record.getAllergy());
        appendLine(sb, "Known comorbidity", record.getComorbidity());
        appendLine(sb, "Current medicines", record.getCurrentMedicines());
        appendLine(sb, "Dynamic form responses", record.getDynamicFormResponses());

        sb.append("\n=== LONGITUDINAL PATIENT HISTORY ===\n");
        appendSection(sb, "Conditions/findings/symptoms/treatment", history.getConditions(), this::conditionSummary);
        appendSection(sb, "Medications", history.getMedications(), this::medicationSummary);
        appendSection(sb, "Encounters", history.getEncounters(), this::encounterSummary);
        appendSection(sb, "Admissions", history.getAdmissions(), this::admissionSummary);
        appendSection(sb, "Vitals history", history.getVitals(), this::vitalSummary);
        appendSection(sb, "Lab results", history.getLabResults(), this::labSummary);
        appendSection(sb, "Documents/reports metadata", history.getDocuments(), this::documentSummary);
        appendLine(sb, "Attached files sent for Gemini analysis", attachments.stream().map(DocumentAttachment::label).toList());

        sb.append(formatPreviousSuggestions(previousSuggestions));
        sb.append(formatPreviousQuestions(previousQuestions));

        sb.append("\nUse root ePCR vital fields as authoritative when duplicate clinicalData keys exist.\n");
        sb.append("Review all attached images/PDFs/reports together with the structured labs and vitals.\n");
        return sb.toString();
    }

    private String buildQuestionPrompt(PatientCareRecord record,
                                       PatientHistorySummaryDTO history,
                                       List<DocumentAttachment> attachments,
                                       String question,
                                       List<AiSuggestion> previousSuggestions,
                                       List<AiSuggestionQuestionAnswer> previousQuestions) {
        StringBuilder sb = new StringBuilder();
        sb.append("=== CLINICIAN QUESTION ===\n");
        sb.append(question.trim()).append("\n\n");
        sb.append("=== INSTRUCTIONS FOR THIS QUESTION ===\n");
        sb.append("Answer the question above with FULL clinical depth using ONLY the patient data below.\n");
        sb.append("Every claim must be supported by an exact data point (lab value, vital, medication, condition, or document) from the record.\n");
        sb.append("Do NOT summarise or truncate. Write all required sections in full, meeting the minimum bullet counts.\n");
        sb.append("If any key data domain is absent from the record, list it explicitly under QA MISSING DATA.\n\n");
        sb.append(buildClinicalPrompt(record, history, attachments, previousSuggestions, previousQuestions));
        sb.append("\n=== REMINDER ===\n");
        sb.append("Answer the clinician question above. Cover ALL relevant data domains from the record.\n");
        sb.append("For dental/implant questions: glycemic control (HbA1c + glucose), active infection signs, ");
        sb.append("imaging findings, periodontal status, bisphosphonate/anticoagulant/immunosuppressant use, ");
        sb.append("healing risk factors (smoking, diabetes, radiation), allergies, BP/cardiac risk.\n");
        sb.append("For medication questions: allergies, drug interactions, renal/hepatic labs, contraindicated conditions.\n");
        sb.append("For surgical questions: cardiovascular clearance, bleeding risk, anesthetic risk, metabolic stability.\n");
        sb.append("Provide minimum bullet counts as specified. Do not truncate any section.\n");
        return sb.toString();
    }

    private List<DocumentAttachment> loadSupportedAttachments(List<PatientDocument> documents) {
        if (documents == null || documents.isEmpty()) {
            return List.of();
        }
        List<DocumentAttachment> attachments = new ArrayList<>();
        for (PatientDocument document : documents) {
            if (attachments.size() >= maxAttachments) {
                break;
            }
            String objectKey = document.getStoredFileUrl();
            if (objectKey == null || objectKey.isBlank() || objectKey.startsWith("/files/")) {
                continue;
            }
            try {
                SupabaseStorageService.StoredFile storedFile = supabaseStorageService.downloadFile(objectKey);
                long contentLength = storedFile.contentLength() == null ? storedFile.bytes().length : storedFile.contentLength();
                if (contentLength > maxAttachmentBytes) {
                    log.info("Skipping AI attachment over size limit: documentId={} bytes={}", document.getId(), contentLength);
                    continue;
                }
                String mimeType = supportedMimeType(storedFile.contentType(), document.getFileName());
                if (mimeType == null) {
                    log.info("Skipping unsupported AI attachment: documentId={} contentType={} fileName={}",
                            document.getId(), storedFile.contentType(), document.getFileName());
                    continue;
                }
                attachments.add(new DocumentAttachment(
                        documentLabel(document),
                        mimeType,
                        Base64.getEncoder().encodeToString(storedFile.bytes())
                ));
            } catch (Exception e) {
                log.warn("Skipping AI attachment documentId={} fileName={} error={}",
                        document.getId(), document.getFileName(), e.getMessage());
            }
        }
        return attachments;
    }

    private String supportedMimeType(String contentType, String fileName) {
        String normalized = contentType == null ? "" : contentType.toLowerCase();
        if (normalized.startsWith("image/") || normalized.equals("application/pdf") || normalized.equals("text/plain")) {
            return normalized;
        }
        String name = fileName == null ? "" : fileName.toLowerCase();
        if (name.endsWith(".pdf")) return "application/pdf";
        if (name.endsWith(".png")) return "image/png";
        if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
        if (name.endsWith(".webp")) return "image/webp";
        if (name.endsWith(".heic")) return "image/heic";
        if (name.endsWith(".heif")) return "image/heif";
        if (name.endsWith(".txt")) return "text/plain";
        return null;
    }

    private String rootVitals(PatientCareRecord r) {
        return "SpO2=" + value(r.getSpo2())
                + ", BP=" + value(r.getSystolicBp()) + "/" + value(r.getDiastolicBp())
                + ", HR=" + value(r.getHeartRate())
                + ", RR=" + value(r.getRespirationRate())
                + ", Pulse=" + value(r.getPulseRate())
                + ", Temp=" + value(r.getTemperature())
                + ", Blood sugar=" + value(r.getBloodSugar())
                + ", Hemoglobin=" + value(r.getHemoglobin())
                + ", GCS=" + value(extractClinicalValue(r.getClinicalData(), "gcs"));
    }

    private Object extractClinicalValue(Map<String, Object> clinicalData, String key) {
        return clinicalData == null ? null : clinicalData.get(key);
    }

    private String conditionSummary(PatientCondition c) {
        return joinNonBlank(
                c.getDateDiagnosed(),
                c.getName(),
                c.getStatus(),
                c.getSeverity(),
                "symptoms=" + value(c.getSymptoms()),
                "findings=" + value(c.getFindings()),
                "analysis=" + value(c.getAnalysis()),
                "recommendedTreatment=" + value(c.getRecommendedTreatment()),
                "notes=" + value(c.getNotes())
        );
    }

    private String medicationSummary(PatientMedication m) {
        return joinNonBlank(m.getName(), m.getDosage(), m.getFrequency(), m.getStatus(), m.getStartDate(), m.getEndDate(), m.getNotes());
    }

    private String encounterSummary(PatientEncounter e) {
        return joinNonBlank(e.getDate(), e.getChiefComplaint(), e.getOutcome(), e.getActiveConditionIds(), e.getNotes());
    }

    private String admissionSummary(PatientAdmission a) {
        return joinNonBlank(a.getHospital(), a.getAdmitDate(), a.getDischargeDate(), a.getReason(), a.getOutcome(), a.getNotes());
    }

    private String vitalSummary(PatientVital v) {
        return joinNonBlank(
                v.getRecordedAt(),
                "BP " + value(v.getSystolicBP()) + "/" + value(v.getDiastolicBP()),
                "HR " + value(v.getHeartRate()),
                "Pulse " + value(v.getPulseRate()),
                "SpO2 " + value(v.getOxygenSaturation()),
                "RR " + value(v.getRespiratoryRate()),
                "O2 method " + value(v.getOxygenDeliveryMethod()),
                "GCS " + value(v.getGlasgowComaScale()),
                "AVPU " + value(v.getAvpu()),
                "Pain " + value(v.getPainScore()) + " " + value(v.getPainLocation()),
                "Temp " + value(v.getTemperature()) + " " + value(v.getTemperatureRoute()),
                "Glucose " + value(v.getBloodGlucose()),
                "Hemoglobin " + value(v.getHemoglobin()),
                "Pupils " + value(v.getPupilLeft()) + "/" + value(v.getPupilRight())
                        + " equal=" + value(v.getPupilsEqual()) + " reactive=" + value(v.getPupilsReactive()),
                "Skin " + value(v.getSkinColor()) + "/" + value(v.getSkinCondition()) + "/" + value(v.getSkinTemperature()),
                v.getNotes()
        );
    }

    private String labSummary(PatientLabResult lab) {
        return joinNonBlank(lab.getDate(), lab.getTestName(), lab.getValue(), lab.getUnit(), lab.getNormalRange(),
                lab.getInterpretation(), lab.getNotes());
    }

    private String documentSummary(PatientDocument doc) {
        return joinNonBlank(doc.getDate(), doc.getType(), doc.getDocumentPhase(), doc.getFileName(), doc.getFileUrl(),
                doc.getNotes());
    }

    private String documentLabel(PatientDocument doc) {
        return joinNonBlank(doc.getType(), doc.getDocumentPhase(), doc.getFileName(), doc.getDate(), doc.getNotes());
    }

    private <T> void appendSection(StringBuilder sb, String label, List<T> values, java.util.function.Function<T, String> mapper) {
        if (values == null || values.isEmpty()) {
            return;
        }
        sb.append(label).append(":\n");
        values.stream()
                .map(mapper)
                .filter(value -> value != null && !value.isBlank())
                .forEach(value -> sb.append("- ").append(value).append('\n'));
    }

    private void appendLine(StringBuilder sb, String label, Object value) {
        if (value == null) {
            return;
        }
        String rendered = String.valueOf(value);
        if (rendered.isBlank() || "[]".equals(rendered) || "{}".equals(rendered)) {
            return;
        }
        sb.append(label).append(": ").append(rendered).append('\n');
    }

    private String joinNonBlank(Object... values) {
        return Arrays.stream(values)
                .filter(Objects::nonNull)
                .map(String::valueOf)
                .filter(s -> !s.isBlank() && !s.equals("unknown"))
                .collect(Collectors.joining(" | "));
    }

    private String value(Object value) {
        return value == null ? "unknown" : String.valueOf(value);
    }

    private String parseTextSection(String text, String section) {
        String body = sectionBody(text, section);
        if (body == null) {
            return "";
        }
        return body.lines()
                .map(line -> line.replaceFirst("^\\s*[-*•]\\s*", "").trim())
                .map(line -> line.replaceAll("\\*\\*([^*]+)\\*\\*", "$1"))  // strip **bold**
                .map(line -> line.replaceAll("\\*([^*]+)\\*", "$1"))          // strip *italic*
                .filter(line -> !line.isBlank())
                .collect(Collectors.joining(" "));
    }

    private List<String> parseBulletSection(String text, String section) {
        String body = sectionBody(text, section);
        if (body == null) {
            return List.of();
        }
        return body.lines()
                .map(line -> line.replaceFirst("^\\s*[-*•]\\s*", "").trim())
                .map(line -> line.replaceAll("\\*\\*([^*]+)\\*\\*", "$1"))  // strip **bold**
                .map(line -> line.replaceAll("\\*([^*]+)\\*", "$1"))          // strip *italic*
                .map(line -> line.replaceAll("^[#]+\\s*", ""))                // strip markdown headers
                .filter(line -> !line.isBlank())
                .toList();
    }

    private String sectionBody(String text, String section) {
        if (text == null || text.isBlank()) {
            return null;
        }
        Pattern startPattern = Pattern.compile("^\\s*" + Pattern.quote(section) + ":\\s*$",
                Pattern.CASE_INSENSITIVE | Pattern.MULTILINE);
        Matcher start = startPattern.matcher(text);
        if (!start.find()) {
            return null;
        }
        Matcher next = SECTION_HEADER_PATTERN.matcher(text);
        int end = text.length();
        while (next.find(start.end())) {
            end = next.start();
            break;
        }
        return text.substring(start.end(), end).trim();
    }

    private String parseRiskLevel(String text) {
        if (text == null) {
            return "LOW";
        }
        String normalized = text.toUpperCase();
        if (normalized.contains("RISK LEVEL: HIGH")) {
            return "HIGH";
        }
        if (normalized.contains("RISK LEVEL: MEDIUM")) {
            return "MEDIUM";
        }
        return "LOW";
    }

    private String cleanAnswer(String answer) {
        if (answer == null) {
            return "";
        }
        return answer.lines()
                .map(line -> line.replaceAll("\\*\\*([^*]+)\\*\\*", "$1"))
                .map(line -> line.replaceAll("\\*([^*]+)\\*", "$1"))
                .collect(Collectors.joining("\n"))
                .trim();
    }


    // ── Q&A section parsers ────────────────────────────────────────────────────
    // Section labels in the Q&A prompt start with "QA " so they never conflict
    // with the analysis prompt's uppercase-only (CLINICAL SUMMARY, FINDINGS, …) pattern.

    private static final Pattern QA_SECTION_HEADER_PATTERN = Pattern.compile(
            "^\\s*QA [A-Z][A-Z A-Z]+:\\s*$",
            Pattern.CASE_INSENSITIVE | Pattern.MULTILINE
    );

    private String parseQaTextSection(String text, String section) {
        String body = qaSection(text, section);
        if (body == null) {
            return cleanAnswer(text);   // fallback: return entire cleaned text
        }
        return body.lines()
                .map(line -> line.replaceFirst("^\\s*[-*•]\\s*", "").trim())
                .map(line -> line.replaceAll("\\*\\*([^*]+)\\*\\*", "$1"))
                .map(line -> line.replaceAll("\\*([^*]+)\\*", "$1"))
                .filter(line -> !line.isBlank())
                .collect(Collectors.joining(" "));
    }

    private List<String> parseQaBulletSection(String text, String section) {
        String body = qaSection(text, section);
        if (body == null) {
            return List.of();
        }
        return body.lines()
                .map(line -> line.replaceFirst("^\\s*[-*•]\\s*", "").trim())
                .map(line -> line.replaceAll("\\*\\*([^*]+)\\*\\*", "$1"))
                .map(line -> line.replaceAll("\\*([^*]+)\\*", "$1"))
                .map(line -> line.replaceAll("^[#]+\\s*", ""))
                .filter(line -> !line.isBlank())
                .toList();
    }

    private String qaSection(String text, String section) {
        if (text == null || text.isBlank()) {
            return null;
        }
        Pattern startPattern = Pattern.compile(
                "^\\s*" + Pattern.quote(section) + ":\\s*$",
                Pattern.CASE_INSENSITIVE | Pattern.MULTILINE
        );
        Matcher start = startPattern.matcher(text);
        if (!start.find()) {
            return null;
        }
        Matcher next = QA_SECTION_HEADER_PATTERN.matcher(text);
        int end = text.length();
        while (next.find(start.end())) {
            end = next.start();
            break;
        }
        return text.substring(start.end(), end).trim();
    }

    private record DocumentAttachment(String label, String mimeType, String base64Data) {}
}
