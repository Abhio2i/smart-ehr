package com.healthcare.epcr.travel.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "travel_vouchers")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TravelVoucher {
    @Id
    private String id;
    
    @Indexed
    private String travelRequestId;
    
    @Indexed
    private String patientId;
    
    private String voucherNumber;
    private Double amount;
    private String status; // DRAFT, SUBMITTED, APPROVED, PAID, REJECTED
    private String approvedBy;
    private String notes;
    
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
