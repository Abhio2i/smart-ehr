package com.healthcare.epcr.ophthalmology.entity;

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

/**
 * Ophthalmology & Eye Team domain — structured eye examination record.
 * Mirrors the structuredVitals pattern already used in ePCR: one record
 * per exam encounter, per-eye (OD/OS) fields, linked optionally to an
 * ePCR incident (recordId) or a standalone ambulatory eye clinic visit.
 */
@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "eye_exams")
@CompoundIndexes({
        @CompoundIndex(name = "patient_examDate_idx", def = "{'patientId': 1, 'examDate': -1}"),
        @CompoundIndex(name = "org_status_idx", def = "{'organizationId': 1, 'status': 1}")
})
public class EyeExam {

    @Id
    private String id;

    @Indexed
    private String patientId;

    /** Optional — set if this exam originated from an ePCR incident. */
    private String recordId;

    @Indexed
    private String organizationId;

    private String facilityId;

    private LocalDateTime examDate;

    /** OD = right eye, OS = left eye, BOTH = both eyes examined this visit. */
    private EyeSide eyeSide;

    private EyeMeasurement rightEye;   // OD
    private EyeMeasurement leftEye;    // OS

    /** Reference to Tele-ophthalmology retinal specialist review, if applicable. */
    private Boolean teleOphthalmologyReview;
    private String reviewingSpecialistId;
    private String reviewingSpecialistNotes;

    /** Attachment IDs — reuses the existing PatientDocument upload pipeline. */
    private java.util.List<String> fundusPhotographyAttachmentIds;

    private String examinedBy;      // userId of OMT / ophthalmologist
    private String examinedByName;

    private String clinicalNotes;

    @Builder.Default
    private ExamStatus status = ExamStatus.COMPLETED;

    @CreatedDate
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    public enum EyeSide { OD, OS, BOTH }

    public enum ExamStatus { SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED }

    /**
     * Per-eye measurement block. Nested rather than flattened so OD/OS
     * stay symmetric and easy to extend.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EyeMeasurement {
        private Double visualAcuity;          // e.g. logMAR or Snellen-decimal
        private String visualAcuityNotation;  // e.g. "20/40"
        private Double intraocularPressure;   // mmHg
        private String octResult;             // Optical Coherence Tomography summary
        private String iolMasterResult;       // IOL Master biometry summary
        private String keratometryResult;     // Keratometry reading
        private String pachymetryResult;      // Corneal thickness (microns)
        private String visualFieldResult;
        private String retinalExamNotes;
        private Boolean retinalInjectionGiven;
    }
}
