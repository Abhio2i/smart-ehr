package com.healthcare.epcr.epcr.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TransportDetail {
    private String transportMode;
    private String transportReason;
    private String refusalOfTransportReason;
    private String destinationFacilityId;
    private String destinationName;
    private String destinationAddress;
    private String destinationType;
    private String receivingPhysicianName;
    private String receivingNurseName;
    private String handoffReport;
    private Boolean hospitalNotified;
    private LocalDateTime hospitalNotifiedAt;
    private String patientConditionOnDeparture;
    private String patientConditionOnArrival;
    private String careLevel;
    private Boolean continuedCPRDuringTransport;
    private Boolean aedUsedDuringTransport;
}
