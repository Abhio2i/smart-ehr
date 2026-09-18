package com.healthcare.epcr.epcr.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "drug_interactions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DrugInteraction {
    @Id
    private String id;
    private String triggerDrugOrClassA; // e.g. "aspirin" or "NSAID"
    private String triggerDrugOrClassB; // e.g. "warfarin" or "ANTICOAGULANT"
    private String riskLevel; // e.g. "HIGH", "MEDIUM", "LOW"
    private String warningMessage;
}
