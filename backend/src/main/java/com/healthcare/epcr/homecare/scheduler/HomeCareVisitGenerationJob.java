package com.healthcare.epcr.homecare.scheduler;

import com.healthcare.epcr.homecare.enums.ReferralStatus;
import com.healthcare.epcr.homecare.enums.VisitStatus;
import com.healthcare.epcr.homecare.model.HomeCareReferral;
import com.healthcare.epcr.homecare.model.HomeCareVisit;
import com.healthcare.epcr.homecare.repository.HomeCareReferralRepository;
import com.healthcare.epcr.homecare.repository.HomeCareVisitRepository;
import com.healthcare.epcr.homecare.util.FrequencyParser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * HomeCareVisitGenerationJob — daily cron job that auto-generates visit occurrences
 * from active referrals for the next 7 days.
 *
 * Pattern: Identical to FollowUpScheduler — @Scheduled + duplicate-guard (existsByReferralIdAndVisitDate).
 * Runs at 1 AM daily so visits are ready for the next day's dispatch board.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class HomeCareVisitGenerationJob {

    private final HomeCareReferralRepository referralRepository;
    private final HomeCareVisitRepository visitRepository;
    private final FrequencyParser frequencyParser;

    /**
     * Daily job: generates visits for the next 7 days from all ACTIVE referrals.
     * Idempotent — existsByReferralIdAndVisitDate prevents duplicates on re-run.
     */
    @Scheduled(cron = "${homecare.scheduler.cron:0 0 1 * * *}",
               zone = "${homecare.scheduler.zone:Asia/Kolkata}")
    public void generateUpcomingVisits() {
        log.info("[HomeCare Job] Starting visit generation for next 7 days...");

        List<HomeCareReferral> activeReferrals =
                referralRepository.findByStatusAndEndDateAfter(ReferralStatus.ACTIVE, LocalDate.now());

        int generated = 0;
        int skipped = 0;

        for (HomeCareReferral referral : activeReferrals) {
            List<LocalDate> visitDates = frequencyParser.resolveNext7Days(
                    referral.getFrequency(), referral.getStartDate());

            for (LocalDate date : visitDates) {
                // Duplicate guard — idempotent
                if (visitRepository.existsByReferralIdAndVisitDate(referral.getId(), date.toString())) {
                    skipped++;
                    continue;
                }

                HomeCareVisit visit = HomeCareVisit.builder()
                        .referralId(referral.getId())
                        .patientId(referral.getPatientId())
                        .patientName(referral.getPatientName())
                        .organizationId(referral.getOrganizationId())
                        .visitDate(date.toString())
                        .community(referral.getHomeCommunity())
                        .status(VisitStatus.UNASSIGNED)
                        .serviceType(referral.getServiceType() != null
                                ? referral.getServiceType().name() : null)
                        .priority(referral.getPriority())
                        .careInstructions(referral.getCareInstructions())
                        .offlineCreated(false)
                        .createdAt(Instant.now())
                        .updatedAt(Instant.now())
                        .build();

                visitRepository.save(visit);
                generated++;
            }
        }

        log.info("[HomeCare Job] Visit generation complete. Generated={}, Skipped(already existed)={}",
                generated, skipped);
    }

    /**
     * End-of-day job: marks ASSIGNED (but not completed) visits as MISSED.
     * Runs at 11:30 PM daily.
     */
    @Scheduled(cron = "${homecare.scheduler.missedCron:0 30 23 * * *}",
               zone = "${homecare.scheduler.zone:Asia/Kolkata}")
    public void markMissedVisits() {
        log.info("[HomeCare Job] Checking for missed visits...");
        List<com.healthcare.epcr.homecare.model.HomeCareVisit> missed =
                visitRepository.findByVisitDateBeforeAndStatus(LocalDate.now().toString(), VisitStatus.ASSIGNED);

        for (com.healthcare.epcr.homecare.model.HomeCareVisit v : missed) {
            v.setStatus(VisitStatus.MISSED);
            v.setUpdatedAt(Instant.now());
            visitRepository.save(v);
            log.warn("[HomeCare Job] Visit {} marked as MISSED — patient: {}, community: {}",
                    v.getId(), v.getPatientId(), v.getCommunity());
        }

        if (!missed.isEmpty()) {
            log.warn("[HomeCare Job] Total MISSED visits marked: {}", missed.size());
        }
    }
}
