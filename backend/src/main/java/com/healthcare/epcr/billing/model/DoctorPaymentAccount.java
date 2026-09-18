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

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "doctor_payment_accounts")
@CompoundIndex(name = "org_doctor_idx", def = "{'organizationId': 1, 'doctorUserId': 1}", unique = true)
public class DoctorPaymentAccount {

    @Id
    private String id;

    private String organizationId;
    private String doctorUserId;
    private String doctorName;
    private String email; // Doctor contact/notification email

    private String accountType; // "BANK_ACCOUNT", "UPI", "RAZORPAY_ROUTE"
    private String accountNumber;
    private String ifscCode;
    private String upiId;
    private String linkedAccountRef; // Razorpay Route account ID

    private BigDecimal commissionPercent;

    @Builder.Default
    private Boolean active = true;

    @CreatedDate
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;
}
