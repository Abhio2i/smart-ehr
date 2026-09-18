package com.healthcare.epcr.retention.model;

import com.healthcare.epcr.retention.enums.DispositionStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;

@Document(collection = "disposition_reviews")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DispositionReview {

    @Id
    private String id;

    @Indexed
    private String organizationId;

    /** Reference ID of the document (TB Case ID, Patient ID, ePCR ID) */
    @Indexed
    private String recordId;

    private String recordType;  // "TB_CASE" | "EPCR" | "PATIENT"
    private String recordName;
    private LocalDate expiryDate;

    private DispositionStatus status;
    private String notes;

    private String reviewedBy;
    private String reviewedByName;
    private Instant reviewedAt;
    private Instant createdAt;
}
