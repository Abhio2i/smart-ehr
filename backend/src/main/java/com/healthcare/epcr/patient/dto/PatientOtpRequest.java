package com.healthcare.epcr.patient.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class PatientOtpRequest {
    @NotBlank
    private String identifier; // email/phone
}
