package com.healthcare.epcr.homecare.repository;

import com.healthcare.epcr.homecare.enums.VisitStatus;
import com.healthcare.epcr.homecare.model.HomeCareVisit;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.LocalDate;
import java.util.List;

public interface HomeCareVisitRepository extends MongoRepository<HomeCareVisit, String> {

    /** Dispatch board — all visits for a day in a community. */
    List<HomeCareVisit> findByVisitDateAndCommunityAndOrganizationId(
            LocalDate visitDate, String community, String organizationId);

    /** Dispatch board — all visits for a day in an org (no community filter). */
    List<HomeCareVisit> findByVisitDateAndOrganizationId(String visitDate, String organizationId);

    /** Nurse's daily schedule. */
    List<HomeCareVisit> findByAssignedNurseIdAndVisitDate(String nurseId, String visitDate);

    /** All visits for a referral. */
    List<HomeCareVisit> findByReferralId(String referralId);

    List<HomeCareVisit> findByAssignedNurseId(String nurseId);

    List<HomeCareVisit> findByReferralIdIn(List<String> referralIds);

    /** All visits for a patient. */
    List<HomeCareVisit> findByPatientId(String patientId);

    /** Recurrence guard — prevents duplicate visit creation. */
    boolean existsByReferralIdAndVisitDate(String referralId, String visitDate);

    /** Unassigned visits for a specific date and org — for auto-suggest. */
    List<HomeCareVisit> findByVisitDateAndStatusAndOrganizationId(
            String visitDate, VisitStatus status, String organizationId);

    /** End-of-day missed visit check. */
    List<HomeCareVisit> findByVisitDateBeforeAndStatus(String date, VisitStatus status);

    /** Count nurse's current day load. */
    long countByAssignedNurseIdAndVisitDate(String nurseId, String visitDate);
}
