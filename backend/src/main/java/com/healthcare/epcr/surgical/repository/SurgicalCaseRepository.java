package com.healthcare.epcr.surgical.repository;

import com.healthcare.epcr.surgical.enums.CaseStatus;
import com.healthcare.epcr.surgical.model.SurgicalCase;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface SurgicalCaseRepository extends MongoRepository<SurgicalCase, String> {

    /** All cases for an organization (admin view). */
    List<SurgicalCase> findByOrganizationId(String organizationId);

    /** Cases for a specific OR with given statuses (for overlap detection read path). */
    List<SurgicalCase> findByOrIdAndStatusIn(String orId, List<CaseStatus> statuses);

    /** All cases for a patient. */
    List<SurgicalCase> findByPatientIdAndOrganizationId(String patientId, String organizationId);

    /** OR board — all cases for an org scheduled in a date range. */
    List<SurgicalCase> findByOrganizationIdAndScheduledStartBetween(
            String organizationId, Instant from, Instant to);

    /** OR board — cases for a specific OR in a date range. */
    List<SurgicalCase> findByOrIdAndOrganizationIdAndScheduledStartBetween(
            String orId, String organizationId, Instant from, Instant to);

    /** Cases for a surgeon on a specific day range. */
    List<SurgicalCase> findBySurgeonIdAndOrganizationIdAndScheduledStartBetween(
            String surgeonId, String organizationId, Instant from, Instant to);

    /** Auto-gen case number uniqueness check. */
    boolean existsByCaseNumber(String caseNumber);

    Optional<SurgicalCase> findByIdAndOrganizationId(String id, String organizationId);

    /** Cases in a given status for an org (e.g. all CHECKED_IN for morning prep). */
    List<SurgicalCase> findByOrganizationIdAndStatus(String organizationId, CaseStatus status);
}
