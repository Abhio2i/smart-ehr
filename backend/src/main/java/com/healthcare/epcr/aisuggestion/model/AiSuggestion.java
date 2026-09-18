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

@Document(collection = "ai_suggestions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiSuggestion {
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
    private String rawResponse;
    private String clinicalSummary;
    private List<String> findings;
    private List<String> clinicalConcerns;
    private List<String> recommendations;
    private List<String> recommendedPlan;
    private List<String> missingData;
    private List<String> attachmentsAnalyzed;
    private String riskLevel;
    @Indexed
    private LocalDateTime createdAt;
}
