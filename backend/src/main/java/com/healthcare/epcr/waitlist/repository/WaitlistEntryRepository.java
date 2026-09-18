package com.healthcare.epcr.waitlist.repository;

import com.healthcare.epcr.waitlist.enums.WaitlistStatus;
import com.healthcare.epcr.waitlist.model.WaitlistEntry;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface WaitlistEntryRepository extends MongoRepository<WaitlistEntry, String> {

    /** All entries for an organization, useful for stats aggregation */
    List<WaitlistEntry> findByOrganizationId(String organizationId);

    /** All entries for a specific patient across org */
    List<WaitlistEntry> findByPatientIdAndOrganizationId(String patientId, String organizationId);

    /** Queue view: WAITING entries for a facility + service type sorted by priority then createdAt */
    List<WaitlistEntry> findByOrganizationIdAndFacilityIdAndServiceTypeAndStatusOrderByPriorityScoreDescCreatedAtAsc(
            String organizationId, String facilityId, String serviceType, WaitlistStatus status);

    List<WaitlistEntry> findByOrganizationIdAndFacilityIdAndServiceTypeAndStatusInOrderByPriorityScoreDescCreatedAtAsc(
            String organizationId, String facilityId, String serviceType, List<WaitlistStatus> statuses);

    /** Offered entries whose offer window has expired (for expiry sweep) */
    List<WaitlistEntry> findByStatusAndOfferExpiresAtBefore(WaitlistStatus status, Instant now);

    /** Count entries ahead of this patient in the queue (used for dynamic position) */
    long countByOrganizationIdAndFacilityIdAndServiceTypeAndStatusAndPriorityScoreGreaterThan(
            String organizationId, String facilityId, String serviceType, WaitlistStatus status, int priorityScore);

    long countByOrganizationIdAndFacilityIdAndServiceTypeAndStatusAndPriorityScoreAndCreatedAtBefore(
            String organizationId, String facilityId, String serviceType, WaitlistStatus status,
            int priorityScore, Instant createdAt);

    /** Count by status for stats */
    long countByOrganizationIdAndStatus(String organizationId, WaitlistStatus status);
}
