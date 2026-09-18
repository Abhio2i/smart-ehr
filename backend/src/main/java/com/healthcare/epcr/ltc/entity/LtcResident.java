package com.healthcare.epcr.ltc.entity;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "ltc_residents")
@CompoundIndexes({
    @CompoundIndex(name = "org_facility_status_idx",
        def = "{'organizationId': 1, 'facilityId': 1, 'status': 1, 'admissionDate': -1}")
})
public class LtcResident {

    @Id
    private String id;

    private String organizationId;   // scoped like every other module here
    private String patientId;        // FK -> Patient (e.g. "PAT-1001")
    private String facilityId;       // FK -> LtcFacility
    private String bedId;            // FK -> beds collection

    private LocalDateTime admissionDate;
    private LocalDateTime dischargeDate;

    private AdmissionType admissionType;
    private ResidentStatus status;

    private CarePlan carePlan;
    private PrimaryCareTeam primaryCareTeam;

    @Version
    private Long version;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String createdBy;
    private String updatedBy;

    public enum AdmissionType { RESTORATIVE, RESPITE, PALLIATIVE, LONG_STAY }
    public enum ResidentStatus { ADMITTED, ACTIVE, ON_LEAVE, DISCHARGED, DECEASED }

    @Data @Builder(toBuilder = true) @NoArgsConstructor @AllArgsConstructor
    public static class CarePlan {
        private List<String> goals;
        private Map<String, Object> preferences;     // Supportive Pathways model
        private List<String> dietaryRestrictions;
        private String mobilityLevel;
        private String careNotes;                     // encrypted care notes
        private LocalDateTime lastReviewedAt;
        private String reviewedBy;
        private LocalDateTime nextReviewDue;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PrimaryCareTeam {
        private String physicianOrNpId;
        private String nurseId;                        // field reference
        private String occupationalTherapistId;
        private String physiotherapistId;
        private String dietitianId;
        private List<ExternalStaff> externalContractedStaff;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ExternalStaff {
        private String name;
        private String role;
        private String agency;
    }
}
