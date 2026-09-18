package com.healthcare.epcr.dental.dto;

import com.healthcare.epcr.dental.entity.DentalChart;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class TreatmentRequest {

    /** Nullable — some treatments (cleaning, screening) aren't tooth-specific. */
    private Integer toothNumber;

    @NotNull(message = "type is required")
    private DentalChart.TreatmentType type;

    @NotBlank(message = "providerRole is required (DENTIST, DENTAL_THERAPIST, HYGIENIST)")
    private String providerRole;

    private String notes;
}
