package com.healthcare.epcr.patienthistory.dto;

import com.healthcare.epcr.patienthistory.enums.TimelineEventType;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PatientTimelineEventDTO {
    private LocalDate date;
    private TimelineEventType type;
    private String sourceId;
    private String patientId;
    private String conditionId;
    private String title;
    private String description;
    private Map<String, Object> metadata;
}
