package com.healthcare.epcr.mentalhealth.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "mental_health_sessions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MentalHealthSessionLog {

    @Id
    private String id;

    @Indexed
    private String caseId;

    @Indexed
    private String patientId;

    private SessionType sessionType;
    private String notes;
    private int durationMinutes;
    private String facilitatedBy;
    private LocalDateTime sessionDate;
    private LocalDateTime loggedAt;
    private String loggedBy;

    public enum SessionType {
        INDIVIDUAL_COUNSELING,
        GROUP_THERAPY,
        CRISIS_INTERVENTION,
        HARM_REDUCTION,
        TRADITIONAL_HEALING,
        OPIOID_THERAPY_CHECKIN
    }
}
