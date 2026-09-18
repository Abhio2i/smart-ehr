package com.healthcare.epcr.ltc.entity;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "ltc_activity_logs")
public class LtcActivityLog {
    @Id
    private String id;
    private String residentId;
    private ActivityType activityType;
    private String description;
    private String facilitatedBy;
    private ParticipationLevel participationLevel;
    private LocalDateTime loggedAt;
    private String loggedBy;

    public enum ActivityType { RECREATION, THERAPY_SESSION, SOCIAL, OUTING }
    public enum ParticipationLevel { FULL, PARTIAL, DECLINED, OBSERVED }
}
