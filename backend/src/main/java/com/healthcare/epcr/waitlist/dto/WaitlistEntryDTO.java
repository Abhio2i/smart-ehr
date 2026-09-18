package com.healthcare.epcr.waitlist.dto;

import com.healthcare.epcr.waitlist.enums.WaitlistPriority;
import com.healthcare.epcr.waitlist.enums.WaitlistStatus;
import lombok.Data;

import java.time.Instant;

/** Read projection for a single waitlist entry. */
@Data
public class WaitlistEntryDTO {

    private String id;
    private String organizationId;
    private String facilityId;
    private String serviceType;
    private String patientId;
    private String patientName;
    private String requestedBy;
    private WaitlistPriority priority;
    private int priorityScore;
    private String reasonForVisit;
    private WaitlistStatus status;
    private Instant createdAt;
    private Instant offeredAt;
    private Instant offerExpiresAt;
    private String offeredSlotId;
    private String scheduledAppointmentId;
    private Instant statusUpdatedAt;
    private String notes;
    private long version;
}
