package com.healthcare.epcr.patient.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class PatientLoginRequest {
    @NotBlank
    private String identifier; // email/phone
    @NotBlank
    private String otp;
}
