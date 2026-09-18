package com.healthcare.epcr.dental.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Oral & Dental Health domain — one chart per patient, holding a running
 * FDI-numbered tooth chart plus a treatment history.
 */
@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "dental_charts")
@CompoundIndexes({
        @CompoundIndex(name = "patient_idx", def = "{'patientId': 1}"),
        @CompoundIndex(name = "org_idx", def = "{'organizationId': 1}")
})
public class DentalChart {

    @Id
    private String id;

    @Indexed(unique = true)
    private String patientId;   // one chart per patient — updated in place, not re-created

    private String organizationId;
    private String facilityId;

    /** FDI two-digit tooth numbering (11-18, 21-28, 31-38, 41-48; primary teeth 51-85). */
    private List<ToothEntry> toothChart;

    private List<TreatmentRecord> treatments;

    private String lastExaminedBy;
    private String lastExaminedByName;
    private LocalDateTime lastExamDate;

    @CreatedDate
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ToothEntry {
        private Integer toothNumber;      // FDI notation, e.g. 16, 24, 46
        private ToothCondition condition;
        private String surfaceNotes;      // e.g. "Occlusal caries", "MOD restoration"
        private LocalDateTime recordedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TreatmentRecord {
        private String treatmentId;       // small unique id, e.g. UUID substring
        private Integer toothNumber;      // nullable — some treatments are whole-mouth (e.g. cleaning)
        private TreatmentType type;
        private String performedBy;       // userId of dentist / dental therapist / hygienist
        private String performedByName;
        private String providerRole;      // DENTIST, DENTAL_THERAPIST, HYGIENIST
        private LocalDateTime performedAt;
        private String notes;
    }

    public enum ToothCondition {
        HEALTHY, CARIES, FILLED, CROWNED, MISSING, IMPACTED, ROOT_CANAL_TREATED, EXTRACTION_INDICATED
    }

    public enum TreatmentType {
        EXAMINATION, CLEANING, FILLING, EXTRACTION, ROOT_CANAL, SEALANT,
        FLUORIDE_APPLICATION, CROWN, SCHOOL_SCREENING, OTHER
    }
}
