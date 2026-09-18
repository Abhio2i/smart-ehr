package com.healthcare.epcr.tb.dto;

import com.healthcare.epcr.tb.enums.ContactRiskLevel;
import com.healthcare.epcr.tb.enums.ExposureType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

@Data
public class LinkContactRequest {

    @NotBlank(message = "Contact name is required")
    private String contactName;

    private String contactPatientId;   // Optional: if registered patient
    private String contactPhone;
    private String contactEmail;
    private String contactAddress;
    private String dateOfBirth;
    private String gender;

    @NotNull(message = "Risk level is required")
    private ContactRiskLevel riskLevel;

    @NotNull(message = "Exposure type is required")
    private ExposureType exposureType;

    private LocalDate exposureStartDate;
    private LocalDate exposureEndDate;
    private Integer avgExposureHoursPerDay;
    private String assignedNurseId;
    private String assignedNurseName;
    private String notes;
}
