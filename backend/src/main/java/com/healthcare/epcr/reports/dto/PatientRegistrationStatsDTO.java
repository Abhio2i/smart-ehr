package com.healthcare.epcr.reports.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PatientRegistrationStatsDTO {
    private long totalPatients;
    private long newPatientsToday;
    private long newPatientsThisWeek;
    private long newPatientsThisMonth;
    private List<DateCountDTO> trend;          // registrations per day
    private Map<String, Long> byOrganization;  // ADMIN only
    private Map<String, Long> byGender;
    private Map<String, Long> byAgeGroup;       // "0-17", "18-40", "41-60", "60+"
}
