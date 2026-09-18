package com.healthcare.epcr.travel.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Document(collection = "medical_travel_requests")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MedicalTravelRequest {
    @Id
    private String id;
    
    @Indexed
    private String patientId;

    /** ePCR Record this travel request was created from. Nullable (may be standalone). */
    @Indexed
    private String epcrRecordId;

    private String organizationId;
    private String requesterId;
    private String patientName;
    private String sourceFacility;
    private String destinationFacility;
    private LocalDate travelDate;
    private String transportType; // FLIGHT, GROUND, AIR_AMBULANCE, etc.
    private String flightNumber;
    private LocalDateTime flightTime;
    
    private String status; // PENDING, APPROVED, BOOKED, COMPLETED, CANCELLED
    
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
