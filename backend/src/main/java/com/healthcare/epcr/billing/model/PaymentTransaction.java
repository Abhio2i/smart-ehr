package com.healthcare.epcr.billing.model;

import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Document(collection = "payment_transactions")
@CompoundIndex(name = "org_claim_idx", def = "{'organizationId': 1, 'claimId': 1}")
public class PaymentTransaction {

    @org.springframework.data.annotation.Id
    private String id;

    private String organizationId;
    private String claimId;
    private String payerId;

    private TransactionType transactionType;
    private BigDecimal amount;
    private String remittanceAdviceRef;
    private String postedByUserId;

    @CreatedDate
    private LocalDateTime postedAt;
}
