package com.healthcare.epcr.ticket.model;

import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Document(collection = "tickets")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Ticket {
    @Id
    private String id;
    private String subject;
    private String description;
    private String category; // e.g. BUG, USABILITY, ACCESS, OTHER
    private String status; // OPEN, IN_PROGRESS, RESOLVED, CLOSED
    private String priority; // LOW, MEDIUM, HIGH, URGENT
    private String createdBy; // User ID
    private String creatorName; // Role + Name of creator
    private String creatorEmail;
    private String creatorPhone;
    private String organizationId;
    private String organizationName;
    private String screenshotKey; // S3 object key
    
    @Transient
    private String screenshotUrl; // Dynamic signed URL generated on request
    
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime resolvedAt;
}
