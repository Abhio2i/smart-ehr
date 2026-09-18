package com.healthcare.epcr.billing.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "doctor_payout_transactions")
@CompoundIndex(name = "org_claim_doc_idx", def = "{'organizationId': 1, 'claimNumber': 1, 'doctorAccountId': 1}", unique = true)
public class DoctorPayoutTransaction {

    @Id
    private String id;

    private String organizationId;
    private String claimNumber;
    private String doctorAccountId;
    private String doctorUserId;
    private String doctorName;
    private String upiId;

    private Double claimTotalAmount;
    private Double commissionPercent;
    private Double payoutAmount; // Server-calculated payout in INR

    private String status; // PENDING, PROCESSING, PROCESSED, FAILED
    private String razorpayPayoutId;
    private String mode; // RAZORPAYX_UPI, SIMULATED_UPI
    private String responseMessage;
    private String initiatedByUserId;

    @CreatedDate
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;
}
