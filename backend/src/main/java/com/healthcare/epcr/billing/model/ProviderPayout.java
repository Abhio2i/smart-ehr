package com.healthcare.epcr.billing.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "provider_payouts")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProviderPayout {
    @Id 
    private String id;
    
    @Indexed 
    private String providerId;
    private String providerName;

    private LocalDate payrollPeriodStart;
    private LocalDate payrollPeriodEnd;

    private Double totalHoursWorked;
    private Double shiftEarnings;
    private Double totalProcedureEarnings;
    private List<PayoutLineItem> lineItems;   // audit trail — har procedure/shift ka breakdown
    private Double totalPayout;

    private String approvalStatus;      // PENDING_REVIEW, APPROVED, PAID, REJECTED
    private String approvedBy;
    private LocalDateTime paidAt;
    private String organizationId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
