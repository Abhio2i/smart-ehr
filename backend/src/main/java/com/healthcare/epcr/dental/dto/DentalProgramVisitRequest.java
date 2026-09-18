package com.healthcare.epcr.dental.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
public class DentalProgramVisitRequest {

    @NotBlank(message = "schoolName is required")
    private String schoolName;

    private String community;

    @NotNull(message = "visitDate is required")
    private LocalDate visitDate;

    private List<String> patientIdsScreened;
    private Integer totalStudentsScreened;
    private Integer referralsNeeded;
    private String notes;
}
