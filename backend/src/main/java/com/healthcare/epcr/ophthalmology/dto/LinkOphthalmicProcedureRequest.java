package com.healthcare.epcr.ophthalmology.dto;

import com.healthcare.epcr.ophthalmology.entity.OphthalmicProcedure;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class LinkOphthalmicProcedureRequest {

    @NotBlank(message = "surgicalCaseId is required")
    private String surgicalCaseId;

    @NotBlank(message = "patientId is required")
    private String patientId;

    @NotNull(message = "category is required")
    private OphthalmicProcedure.ProcedureCategory category;

    private String eyeSide;
    private String notes;
}
