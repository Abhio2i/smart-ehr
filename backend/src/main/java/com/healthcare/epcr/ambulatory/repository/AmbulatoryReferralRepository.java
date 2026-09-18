package com.healthcare.epcr.ambulatory.repository;

import com.healthcare.epcr.ambulatory.entity.AmbulatoryReferral;
import com.healthcare.epcr.ambulatory.entity.AmbulatoryReferral.ReferralStatus;
import com.healthcare.epcr.ambulatory.entity.AmbulatorySpecialty;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

/**
 * Repository for AmbulatoryReferral.
 *
 * The compound index (organizationId, specialty, status, createdAt DESC) on the
 * collection makes all four variants below efficient without a full collection scan.
 */
public interface AmbulatoryReferralRepository extends MongoRepository<AmbulatoryReferral, String> {

    /** Full filter: org + specialty + status — main list endpoint with all filters. */
    Page<AmbulatoryReferral> findByOrganizationIdAndSpecialtyAndStatus(
        String organizationId,
        AmbulatorySpecialty specialty,
        ReferralStatus status,
        Pageable pageable
    );

    /** Filter: org + specialty only. */
    Page<AmbulatoryReferral> findByOrganizationIdAndSpecialty(
        String organizationId,
        AmbulatorySpecialty specialty,
        Pageable pageable
    );

    /** Filter: org + status only. */
    Page<AmbulatoryReferral> findByOrganizationIdAndStatus(
        String organizationId,
        ReferralStatus status,
        Pageable pageable
    );

    /** No filter — all referrals for this org (paginated). */
    Page<AmbulatoryReferral> findByOrganizationId(
        String organizationId,
        Pageable pageable
    );
}
