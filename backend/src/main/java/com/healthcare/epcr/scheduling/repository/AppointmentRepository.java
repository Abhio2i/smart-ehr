package com.healthcare.epcr.scheduling.repository;

import com.healthcare.epcr.scheduling.model.Appointment;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface AppointmentRepository extends MongoRepository<Appointment, String> {
    Optional<Appointment> findByIdempotencyKey(String idempotencyKey);
    List<Appointment> findByPatientId(String patientId);
    List<Appointment> findByProviderId(String providerId);
    List<Appointment> findByOrganizationId(String organizationId);
    List<Appointment> findByStatusAndScheduledStartBetweenAndReminderSentFalse(
            String status, Instant start, Instant end);

    // ── NEW ──────────────────────────────────────────────────────────────────
    /** Org-scoped appointment list with status filter */
    List<Appointment> findByOrganizationIdAndStatus(String organizationId, String status);

    /** Count for stats — booked today in org */
    long countByOrganizationIdAndStatusAndScheduledStartBetween(
            String organizationId, String status, Instant start, Instant end);

    /** Pending reminder count for org */
    long countByOrganizationIdAndReminderSentFalseAndStatus(
            String organizationId, String status);
}

