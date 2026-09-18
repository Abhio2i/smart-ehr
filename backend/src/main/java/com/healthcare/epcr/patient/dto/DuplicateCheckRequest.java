package com.healthcare.epcr.patient.dto;

import lombok.Data;

/**
 * Request body for POST /api/patients/duplicate-check
 */
@Data
public class DuplicateCheckRequest {
    private String patientName;
    private String dateOfBirth;
    private String phone;
}
