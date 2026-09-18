package com.healthcare.epcr.mentalhealth.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "mental_health_cases")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@CompoundIndexes({
    @CompoundIndex(name = "mh_org_status_idx", def = "{'organizationId': 1, 'status': 1}"),
    @CompoundIndex(name = "mh_facility_status_idx", def = "{'assignedFacilityId': 1, 'status': 1}")
})
public class MentalHealthCase {

    @Id
    private String id;

    @Indexed
    private String organizationId;

    @Indexed
    private String patientId;

    @Indexed
    private String caseNumber;

    private String assignedFacilityId; // e.g. STH, HRRHC, IRH, or Community Clinic
    private String assignedProviderId;

    private AdmissionType admissionType;
    private CaseStatus status;
    private SuicideRiskLevel riskLevel;
    private String riskNotes;

    // Addictions & Harm Reduction
    private String primarySubstance; // ALCOHOL, OPIOIDS, CANNABIS, STIMULANTS, POLYSUBSTANCE
    private boolean onOpioidAgonistTherapy; // OAT
    private String fasdStatus; // NOT_ASSESSED, IN_EVALUATION, CONFIRMED_DIAGNOSIS, RULED_OUT

    // Personal Recovery Plan
    private RecoveryPlan recoveryPlan;

    @Version
    private Long version;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String createdBy;

    public enum AdmissionType {
        VOLUNTARY,
        FORM_1_INVOLUNTARY_STH,
        FORM_1_INVOLUNTARY_HRRHC,
        FORM_1_INVOLUNTARY_IRH,
        COMMUNITY_CARE
    }

    public enum CaseStatus {
        OPEN_INTAKE,
        ACTIVE_TREATMENT,
        CRISIS_STABILIZATION,
        RECOVERY_MAINTENANCE,
        DISCHARGED
    }

    public enum SuicideRiskLevel {
        LOW,
        MODERATE,
        HIGH,
        CRITICAL
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RecoveryPlan {
        private List<String> goals;
        private List<String> copingMechanisms;
        private String crisisSafetyPlan;
        private boolean traditionalHealingIncluded;
        private String emergencyContact;
        private LocalDateTime lastUpdated;
        private String updatedBy;
    }
}
