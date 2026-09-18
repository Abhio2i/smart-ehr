package com.healthcare.epcr.waitlist.model;

import com.healthcare.epcr.waitlist.enums.WaitlistPriority;
import com.healthcare.epcr.waitlist.enums.WaitlistStatus;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Represents a patient's entry in the service waitlist.
 *
 * Key design decisions:
 * - NO stored position field: position is computed at query time via countDocuments
 *   over the ESR (Equality-Sort-Range) compound index. This eliminates race conditions
 *   from re-numbering positions on every add/remove operation.
 * - Atomic offer via findAndModify (same pattern as PatientScheduleService.bookSlot)
 * - version field for optimistic locking on non-atomic updates
 *
 * ESR compound index layout for queue lookup:
 *   { organizationId: 1, facilityId: 1, serviceType: 1, status: 1, priorityScore: -1, createdAt: 1 }
 *   Equality: organizationId, facilityId, serviceType, status
 *   Sort:     priorityScore DESC, createdAt ASC
 */
@Data
@Document(collection = "waitlist_entries")
@CompoundIndexes({
    @CompoundIndex(
        name = "queue_lookup_esr",
        def = "{'organizationId':1,'facilityId':1,'serviceType':1,'status':1,'priorityScore':-1,'createdAt':1}"
    )
})
public class WaitlistEntry {

    @Id
    private String id;

    /** Organization owning this waitlist entry */
    private String organizationId;

    /** Facility (clinic/hospital) the patient is waiting for */
    private String facilityId;

    /**
     * Service type the patient is waiting for — e.g. "CARDIOLOGY", "DENTAL", "SURGICAL_CARE".
     * Maps to specialty/incidentType routing in existing modules.
     */
    private String serviceType;

    private String patientId;
    private String patientName;

    /** userId of the physician/paramedic who created this waitlist entry */
    private String requestedBy;

    /** Human-readable priority label */
    private WaitlistPriority priority;

    /**
     * Numeric priority score derived from WaitlistPriority.
     * Used for MongoDB sort (priorityScore DESC, createdAt ASC) — never stored as position.
     */
    private int priorityScore;

    private String reasonForVisit;

    private WaitlistStatus status;

    private Instant createdAt;

    /** Timestamp when the slot offer was made */
    private Instant offeredAt;

    /** Expiry time of the current offer (default: 24 hours after offeredAt) */
    private Instant offerExpiresAt;

    /** ID of the AppointmentSlot that was offered to this patient */
    private String offeredSlotId;

    /** ID of the Appointment created when the patient accepts the offer */
    private String scheduledAppointmentId;

    private Instant statusUpdatedAt;

    /** Optional clinical notes or additional context */
    private String notes;

    /**
     * Optimistic locking version for non-atomic updates (priority changes, etc.)
     * Not used in findAndModify paths — those are inherently atomic.
     */
    @Version
    private long version;
}
