package com.healthcare.epcr.hipaa.disclosure.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class CreateDisclosureRequest {
    @NotBlank
    private String organizationId;
    @NotBlank
    private String patientId;
    private String recordId;
    private String recipientType;
    private String recipientName;
    private String purpose;
    private List<String> dataElements;
    private String legalBasis;
    private String consentId;
    private String method;
    private String requestId;
}

