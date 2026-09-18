package com.healthcare.epcr.hipaa.patientrights.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@Document(collection = "amendment_requests")
public class AmendmentRequest {
    @Id
    private String id;
    @Indexed
    private String organizationId;
    @Indexed
    private String patientId;
    private String recordId;
    private List<Map<String, String>> requestedChanges;
    private String status; // SUBMITTED, APPROVED, DENIED, CANCELLED
    private String reason;
    private String reviewedBy;
    private String denialReason;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

