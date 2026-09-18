package com.healthcare.epcr.tb.dto;

import com.healthcare.epcr.tb.enums.TbClassification;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
public class CreateTbCaseRequest {

    @NotBlank(message = "Patient ID is required")
    private String patientId;

    @NotBlank(message = "Patient name is required")
    private String patientName;

    private String patientDob;
    private String patientPhone;
    private String patientAddress;

    @NotNull(message = "Classification is required")
    private TbClassification classification;

    private String tbSite;
    private LocalDate symptomStartDate;
    private LocalDate diagnosisDate;
    private LocalDate notificationDate;
    private LocalDate treatmentStartDate;
    private List<String> riskFactors;
    private String assignedNurseId;
    private String assignedNurseName;
    private String facilityId;
    private String notes;
}
