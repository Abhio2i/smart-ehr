package com.healthcare.epcr.aisuggestion.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "ai_suggestion_questions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiSuggestionQuestionAnswer {
    @Id
    private String id;
    @Indexed
    private String recordId;
    @Indexed
    private String patientId;
    @Indexed
    private String organizationId;
    private String requestedBy;
    private String modelProvider;
    private String question;
    /** Direct answer sentence(s) — "No obvious issue", "Proceed with caution", etc. */
    private String answer;
    /** Evidence items pulled from this case (labs, vitals, imaging, history) */
    private List<String> evidenceFromCase;
    /** Clinical reasoning bullets explaining why the evidence supports the answer */
    private List<String> clinicalReasoning;
    /** Practical next steps for the doctor/dentist/paramedic */
    private List<String> recommendedNextStep;
    /** Missing clinical data that would improve the answer */
    private List<String> missingData;
    private List<String> attachmentsAnalyzed;
    @Indexed
    private LocalDateTime createdAt;
}
