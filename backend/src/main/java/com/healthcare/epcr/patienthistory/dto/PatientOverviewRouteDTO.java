package com.healthcare.epcr.patienthistory.dto;

import com.healthcare.epcr.patienthistory.enums.PatientOverviewType;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PatientOverviewRouteDTO {
    private String patientId;
    private String recordId;
    private String incidentType;
    private PatientOverviewType overviewType;
    private String frontendRouteKey;
}
