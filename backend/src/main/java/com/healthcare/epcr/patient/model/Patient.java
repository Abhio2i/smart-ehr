package com.healthcare.epcr.patient.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Document(collection = "patients")
public class Patient {
    @Id
    private String id;
    @Indexed(unique = true)
    private String patientId;
    @Indexed
    private String organizationId;
    private String email;
    private String phone;
    private boolean active;
    private String otpHash;
    private LocalDateTime otpExpiresAt;
    private LocalDateTime lastLoginAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    private com.healthcare.epcr.retention.model.RetentionMetadata retentionMetadata;
}

