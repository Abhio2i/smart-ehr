package com.healthcare.epcr.ltc.dto;

import com.healthcare.epcr.ltc.entity.LtcResident;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class AdmitResidentRequest {
    @NotBlank(message = "patientId is required")
    private String patientId;

    @NotBlank(message = "facilityId is required")
    private String facilityId;

    @NotNull(message = "admissionType is required")
    private LtcResident.AdmissionType admissionType;

    private List<String> goals;
    private Map<String, Object> preferences;
    private List<String> dietaryRestrictions;
    private String mobilityLevel;
    private String physicianOrNpId;
    private String nurseId;
}
