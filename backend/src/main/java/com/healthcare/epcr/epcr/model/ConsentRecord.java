package com.healthcare.epcr.epcr.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ConsentRecord {
    private Boolean patientConsentObtained;
    private String consentType;
    private Boolean refusalOfCare;
    private String refusalReason;
    private Boolean refusalWitnessed;
    private String witnessName;
    private String witnessContact;
    private Boolean patientInformedOfRisks;
    private Boolean patientHasDecisionCapacity;
    private String capacityAssessmentNotes;
    private Boolean guardianConsentObtained;
    private String guardianName;
    private String guardianRelationship;
    private String guardianPhone;
    private String patientSignatureAttachmentId;
    private String guardianSignatureAttachmentId;
    private String crewSignatureAttachmentId;
}
