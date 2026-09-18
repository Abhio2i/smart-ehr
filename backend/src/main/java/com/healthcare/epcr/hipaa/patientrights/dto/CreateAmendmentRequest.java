package com.healthcare.epcr.hipaa.patientrights.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class CreateAmendmentRequest {
    @NotBlank
    private String organizationId;
    @NotBlank
    private String patientId;
    @NotBlank
    private String recordId;
    private List<Map<String, String>> requestedChanges;
    private String reason;
}

