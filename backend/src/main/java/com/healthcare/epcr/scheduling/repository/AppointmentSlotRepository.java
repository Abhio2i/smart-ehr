package com.healthcare.epcr.scheduling.repository;

import com.healthcare.epcr.scheduling.model.AppointmentSlot;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface AppointmentSlotRepository extends MongoRepository<AppointmentSlot, String> {

    // Original — provider scoped (all statuses)
    List<AppointmentSlot> findByProviderIdAndStatusAndSlotStartBetween(
            String providerId, String status, Instant start, Instant end);

    // Facility scoped
    List<AppointmentSlot> findByFacilityIdAndStatusAndSlotStartBetween(
            String facilityId, String status, Instant start, Instant end);

    // ── NEW: Org-scoped queries (for Manager isolation) ─────────────────────

    /** All slots for an org within a date-time window */
    List<AppointmentSlot> findByOrganizationIdAndSlotStartBetween(
            String organizationId, Instant start, Instant end);

    /** Org + status filter (e.g. OPEN slots today for a manager) */
    List<AppointmentSlot> findByOrganizationIdAndStatusAndSlotStartBetween(
            String organizationId, String status, Instant start, Instant end);

    /** Provider + org combined (manager can query a specific provider in their org) */
    List<AppointmentSlot> findByProviderIdAndOrganizationIdAndSlotStartBetween(
            String providerId, String organizationId, Instant start, Instant end);

    /** All OPEN slots org-wide for a date range (for holiday bulk-block) */
    List<AppointmentSlot> findByOrganizationIdAndProviderIdAndStatusAndSlotStartBetween(
            String organizationId, String providerId, String status, Instant start, Instant end);

    /** Count by org and status — used for stats endpoint */
    long countByOrganizationIdAndStatus(String organizationId, String status);

    /** Count by org and status and time window — booked today etc. */
    long countByOrganizationIdAndStatusAndSlotStartBetween(
            String organizationId, String status, Instant start, Instant end);

    void deleteByStatusAndSlotStartBefore(String status, Instant threshold);
}

