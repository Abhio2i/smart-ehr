package com.healthcare.epcr.hipaa.consent.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class CreateConsentRequest {
    @NotBlank
    private String consentType;
    private LocalDateTime effectiveFrom;
    private LocalDateTime effectiveTo;
    private List<String> dataCategories;
    private List<String> recipientTypes;
    private String captureMethod;
    private String documentRef;
}

