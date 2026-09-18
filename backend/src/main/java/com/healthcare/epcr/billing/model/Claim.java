package com.healthcare.epcr.billing.model;

import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Document(collection = "claims")
@CompoundIndexes({
    @CompoundIndex(name = "org_status_idx", def = "{'organizationId': 1, 'status': 1, 'createdAt': -1}"),
    @CompoundIndex(name = "org_patient_idx", def = "{'organizationId': 1, 'patientId': 1}"),
    @CompoundIndex(name = "org_claimnum_idx", def = "{'organizationId': 1, 'claimNumber': 1}", unique = true)
})
public class Claim {

    @org.springframework.data.annotation.Id
    private String id;

    // NEVER set from client input — always derived server-side from JWT
    @Field("organizationId")
    private String organizationId;

    private String claimNumber;
    private String patientId;
    private String patientName;
    private String doctorUserId;
    private String doctorName;
    private String epcrRecordId;

    private ClaimStatus status = ClaimStatus.DRAFT;
    private PayerType payerType;
    private String payerId;
    private String payerClaimReference;

    private List<ClaimLineItem> lineItems = new ArrayList<>();

    private BigDecimal totalCharged = BigDecimal.ZERO;
    private BigDecimal totalAllowed = BigDecimal.ZERO;
    private BigDecimal totalPaid = BigDecimal.ZERO;
    private BigDecimal patientResponsibility = BigDecimal.ZERO;

    private String denialReason;
    private String denialCode;
    private LocalDateTime appealDeadline;

    private String notes;
    private String idempotencyKey;
    private String createdByUserId;

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    private LocalDateTime submittedAt;
    private LocalDateTime adjudicatedAt;

    @CreatedDate
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    // optimistic locking — protects against concurrent status transitions
    @Version
    private Long version;
}
