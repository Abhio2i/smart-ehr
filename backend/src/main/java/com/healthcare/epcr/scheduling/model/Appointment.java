package com.healthcare.epcr.scheduling.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Document(collection = "appointments")
public class Appointment {
    @Id
    private String id;
    private String slotId;
    private String patientId;
    private String providerId;
    private String organizationId;
    private String facilityId;
    private Instant scheduledStart;
    private Instant scheduledEnd;
    private String status;  // SCHEDULED, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW
    private String appointmentType;
    private String patientName;
    private String providerName;
    private String patientPhone;
    private String reasonForVisit;
    private String idempotencyKey;
    private String travelBundleId;   // nullable, links to TravelBundle
    private boolean reminderSent;
    private Instant createdAt;
    private Instant updatedAt;
}
