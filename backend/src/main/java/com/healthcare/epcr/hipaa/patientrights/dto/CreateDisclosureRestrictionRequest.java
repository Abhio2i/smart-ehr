package com.healthcare.epcr.hipaa.patientrights.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class CreateDisclosureRestrictionRequest {
    @NotBlank
    private String organizationId;
    @NotBlank
    private String patientId;
    @NotBlank
    private String restrictionType;
    private List<String> fields;
}

