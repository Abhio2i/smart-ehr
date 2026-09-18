package com.healthcare.epcr.followup.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "follow_up_tasks")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FollowUpTask {
    @Id
    private String id;

    private String patientId;

    @Indexed(unique = true, sparse = true)
    private String recordId;

    private String sourceType;
    private String vitalId;
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
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
