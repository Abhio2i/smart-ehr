package com.healthcare.epcr.dental.dto;

import com.healthcare.epcr.dental.entity.DentalChart;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ToothEntryRequest {

    @NotNull(message = "toothNumber is required (FDI notation, e.g. 16, 24, 46)")
    private Integer toothNumber;

    @NotNull(message = "condition is required")
    private DentalChart.ToothCondition condition;

    private String surfaceNotes;
}
