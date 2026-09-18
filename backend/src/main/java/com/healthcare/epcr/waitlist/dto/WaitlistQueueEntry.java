package com.healthcare.epcr.waitlist.dto;

import com.healthcare.epcr.waitlist.enums.WaitlistPriority;
import com.healthcare.epcr.waitlist.enums.WaitlistStatus;
import lombok.Data;

import java.time.Instant;

/**
 * A single row in the queue listing.
 * Includes the dynamically computed position and estimated wait time.
 */
@Data
public class WaitlistQueueEntry {

    private String id;
    private String patientId;
    private String patientName;
    private WaitlistPriority priority;
    private int priorityScore;
    private String reasonForVisit;
    private WaitlistStatus status;
    private Instant createdAt;
    private Instant offeredAt;
    private Instant offerExpiresAt;
    private String notes;
    private String serviceType;
    private String facilityId;

    /**
     * 1-based queue position computed at query time using:
     *   countDocuments where status=WAITING AND
     *   (priorityScore > this.priorityScore OR
     *    (priorityScore == this.priorityScore AND createdAt < this.createdAt))
     * Plus 1.
     * Avoids race-condition-prone stored positions.
     */
    private int queuePosition;

    /**
     * Rough estimated wait time in minutes.
     * Calculated as: queuePosition * averageServiceDurationMinutes (default 30 min).
     * -1 if unable to estimate.
     */
    private int estimatedWaitMinutes;
}
