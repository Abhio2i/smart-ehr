package com.healthcare.epcr.hipaa.breakglass.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Document(collection = "break_glass_events")
public class BreakGlassEvent {
    @Id
    private String id;
    @Indexed
    private String organizationId;
    private String userId;
    private String patientId;
    private String justification;
    private LocalDateTime startedAt;
    private LocalDateTime expiresAt;
    private LocalDateTime endedAt;
    private String status; // ACTIVE, CLOSED
}

