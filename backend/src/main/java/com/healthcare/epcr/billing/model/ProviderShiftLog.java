package com.healthcare.epcr.billing.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "provider_shift_logs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProviderShiftLog {
    @Id 
    private String id;
    
    @Indexed 
    private String providerId;
    private LocalDateTime shiftStart;
    private LocalDateTime shiftEnd;
    private Double hoursWorked;         // computed on checkout
    private String sourceType;          // MANUAL, HOMECARE_VISIT, SURGICAL_CASE, EPCR_INCIDENT
    private String sourceRefId;         // link back to HomeCareVisit/SurgicalCase/PatientCareRecord id
    private String status;              // OPEN, CLOSED, LOCKED
    private String payoutId;            // linked payout once locked
    private String organizationId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
