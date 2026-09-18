package com.healthcare.epcr.epcr.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MedicationSafetyAlert {
    private String riskLevel; // e.g. "HIGH", "MEDIUM", "NONE"
    private String warningMessage;
    private String triggerField; // e.g. "Allergy", "Drug-Drug Interaction"
}
