package com.healthcare.epcr.homecare.repository;

import com.healthcare.epcr.homecare.enums.ReferralStatus;
import com.healthcare.epcr.homecare.model.HomeCareReferral;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.LocalDate;
import java.util.List;

public interface HomeCareReferralRepository extends MongoRepository<HomeCareReferral, String> {

    List<HomeCareReferral> findByOrganizationId(String organizationId);

    List<HomeCareReferral> findByPatientId(String patientId);

    List<HomeCareReferral> findByOrganizationIdAndStatus(String organizationId, ReferralStatus status);

    /** Used by recurrence engine to find referrals that need visit generation. */
    List<HomeCareReferral> findByStatusAndEndDateAfter(ReferralStatus status, LocalDate date);

    List<HomeCareReferral> findByOrganizationIdAndHomeCommunity(String organizationId, String homeCommunity);
}
