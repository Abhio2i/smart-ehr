package com.healthcare.epcr.ophthalmology.dto;

import com.healthcare.epcr.ophthalmology.entity.EyeExam;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class EyeExamRequest {

    @NotBlank(message = "patientId is required")
    private String patientId;

    /** Optional link back to an ePCR incident. */
    private String recordId;

    private String facilityId;

    @NotNull(message = "examDate is required")
    private LocalDateTime examDate;

    @NotNull(message = "eyeSide is required")
    private EyeExam.EyeSide eyeSide;

    @Valid
    private EyeMeasurementDto rightEye;

    @Valid
    private EyeMeasurementDto leftEye;

    private Boolean teleOphthalmologyReview;
    private String reviewingSpecialistId;
    private String reviewingSpecialistNotes;

    private List<String> fundusPhotographyAttachmentIds;

    private String clinicalNotes;

    @Data
    public static class EyeMeasurementDto {
        private Double visualAcuity;
        private String visualAcuityNotation;
        private Double intraocularPressure;
        private String octResult;
        private String iolMasterResult;
        private String keratometryResult;
        private String pachymetryResult;
        private String visualFieldResult;
        private String retinalExamNotes;
        private Boolean retinalInjectionGiven;
    }
}
