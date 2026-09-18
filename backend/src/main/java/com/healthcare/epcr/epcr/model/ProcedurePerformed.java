package com.healthcare.epcr.epcr.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProcedurePerformed {
    private String procedureName;
    private LocalDateTime performedAt;
    private String performedBy;
    private Boolean successful;
    private Integer attempts;
    private String bodysite;
    private String complications;
    private String patientResponse;
    private String snomedCode;
    private String notes;
}
