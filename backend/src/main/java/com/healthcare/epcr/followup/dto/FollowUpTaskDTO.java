package com.healthcare.epcr.followup.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class FollowUpTaskDTO {
    private String id;
    private String patientId;
    private String recordId;
    private String organizationId;
    private String paramedicsId;
    private String patientEmail;
    private String patientName;
    private String incidentNumber;
    private LocalDate incidentDate;
    private LocalDate dueDate;
    private String status;
    private String triggeredByRule;
    private List<String> criticalReasons;
    private Integer attemptCount;
    private LocalDateTime lastAttemptAt;
    private LocalDateTime sentAt;
    private String lastError;
}
