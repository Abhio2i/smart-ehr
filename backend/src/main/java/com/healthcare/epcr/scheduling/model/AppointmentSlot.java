package com.healthcare.epcr.scheduling.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;

import java.time.Instant;

@Data
@Document(collection = "appointment_slots")
@CompoundIndexes({
    @CompoundIndex(name = "provider_slot_unique", def = "{'providerId': 1, 'slotStart': 1}", unique = true)
})
public class AppointmentSlot {
    @Id
    private String id;
    private String organizationId;
    private String providerId;
    private String facilityId;
    private Instant slotStart;
    private Instant slotEnd;
    private String status;         // OPEN, BOOKED, BLOCKED
    private String appointmentId;  // set when BOOKED
    private String blockReason;    // set when BLOCKED (e.g. "Doctor on holiday Jul 10-20")
}

