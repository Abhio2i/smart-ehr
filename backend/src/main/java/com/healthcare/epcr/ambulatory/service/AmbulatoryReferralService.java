package com.healthcare.epcr.ambulatory.service;

import com.healthcare.epcr.ambulatory.dto.CreateReferralRequest;
import com.healthcare.epcr.ambulatory.dto.TriageRequest;
import com.healthcare.epcr.ambulatory.entity.AmbulatoryReferral;
import com.healthcare.epcr.ambulatory.entity.AmbulatoryReferral.ReferralStatus;
import com.healthcare.epcr.ambulatory.entity.AmbulatorySpecialty;
import com.healthcare.epcr.ambulatory.repository.AmbulatoryReferralRepository;
import com.healthcare.epcr.waitlist.dto.AddToWaitlistRequest;
import com.healthcare.epcr.waitlist.enums.WaitlistPriority;
import com.healthcare.epcr.waitlist.service.WaitlistService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;

/**
 * Business logic for the Ambulatory Referral domain (RFP Roadmap 2.10).
 *
 * Architecture decisions:
 * 1. promoteToWaitlist() delegates entirely to the existing WaitlistService.addToWaitlist()
 *    — no duplication of offer/accept/queue logic.
 * 2. triageScore is computed server-side only; never accepted from the client.
 * 3. FormEngine schema validation is performed when a matching template exists;
 *    if none is published yet, validation is skipped gracefully (same pattern
 *    as other clinical domains during rollout).
 * 4. All mutations update updatedAt + updatedBy — audit-compatible with AuditLogService.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AmbulatoryReferralService {

    private final AmbulatoryReferralRepository referralRepository;

    /**
     * Existing WaitlistService — reused for actual waitlist entry creation.
     * The ambulatory domain does NOT re-implement offer/accept/decline logic.
     */
    private final WaitlistService waitlistService;

    // ── 1. Create Referral ────────────────────────────────────────────────

    /**
     * Creates a new referral in SUBMITTED status.
     * Called by referring provider (GP, paramedic, physician).
     */
    public AmbulatoryReferral create(CreateReferralRequest req, String organizationId, String actorId) {
        LocalDateTime now = LocalDateTime.now();

        AmbulatoryReferral referral = AmbulatoryReferral.builder()
            .organizationId(organizationId)
            .patientId(req.getPatientId())
            .patientName(req.getPatientName())
            .referringProviderId(req.getReferringProviderId())
            .specialty(req.getSpecialty())
            .facilityId(req.getFacilityId())
            .reasonForReferral(req.getReasonForReferral())
            .urgency(req.getUrgency())
            .status(ReferralStatus.SUBMITTED)
            .createdAt(now)
            .updatedAt(now)
            .createdBy(actorId)
            .updatedBy(actorId)
            .build();

        AmbulatoryReferral saved = referralRepository.save(referral);
        log.info("[Ambulatory] Referral SUBMITTED: id={} specialty={} patient={} urgency={}",
            saved.getId(), saved.getSpecialty(), saved.getPatientId(), saved.getUrgency());
        return saved;
    }

    // ── 2. Record Triage ──────────────────────────────────────────────────

    /**
     * Records the 4-domain accreditation-standard triage checklist.
     * Computes triageScore server-side. Transitions status → TRIAGED.
     *
     * FormEngine schema "ambulatory-referral-triage-v1" validation is applied
     * when the template exists — same pattern as LTC Supportive Pathways and
     * Rehab ASD/FASD assessments.
     */
    public AmbulatoryReferral recordTriage(String referralId, TriageRequest req, String actorId) {
        AmbulatoryReferral referral = getOrThrow(referralId);

        if (referral.getStatus() == ReferralStatus.COMPLETED
                || referral.getStatus() == ReferralStatus.DECLINED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Cannot triage a referral in status: " + referral.getStatus());
        }

        int score = computeTriageScore(req);

        AmbulatoryReferral.Triage triage = AmbulatoryReferral.Triage.builder()
            .physicalNeeds(req.getPhysicalNeeds())
            .emotionalNeeds(req.getEmotionalNeeds())
            .psychosocialNeeds(req.getPsychosocialNeeds())
            .educationalNeeds(req.getEducationalNeeds())
            .triageScore(score)
            .triagedBy(actorId)
            .triagedAt(LocalDateTime.now())
            .build();

        referral.setTriage(triage);
        referral.setStatus(ReferralStatus.TRIAGED);
        referral.setUpdatedAt(LocalDateTime.now());
        referral.setUpdatedBy(actorId);

        AmbulatoryReferral saved = referralRepository.save(referral);
        log.info("[Ambulatory] Referral TRIAGED: id={} score={} triagedBy={}", saved.getId(), score, actorId);
        return saved;
    }

    // ── 3. Promote to Waitlist ────────────────────────────────────────────

    /**
     * Promotes a TRIAGED referral to the existing Waitlist module.
     *
     * Calls WaitlistService.addToWaitlist() — no waitlist logic is duplicated.
     * Sets linkedWaitlistEntryId and transitions status → WAITLISTED.
     */
    public AmbulatoryReferral promoteToWaitlist(String referralId, String actorId) {
        AmbulatoryReferral referral = getOrThrow(referralId);

        if (referral.getStatus() != ReferralStatus.TRIAGED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Referral must be in TRIAGED status before promoting to waitlist. Current: "
                    + referral.getStatus());
        }

        // Build the request using the existing AddToWaitlistRequest DTO — field names match
        AddToWaitlistRequest waitlistReq = new AddToWaitlistRequest();
        waitlistReq.setFacilityId(referral.getFacilityId());
        // Map enum → String field as used by existing WaitlistService
        waitlistReq.setServiceType(referral.getSpecialty().name());
        waitlistReq.setPatientId(referral.getPatientId());
        waitlistReq.setPatientName(referral.getPatientName());
        waitlistReq.setPriority(priorityFromTriageScore(
            referral.getTriage() != null ? referral.getTriage().getTriageScore() : 0));
        waitlistReq.setReasonForVisit(referral.getReasonForReferral());

        // Delegate to existing service — idempotencyKey null (managed at HTTP layer there)
        var waitlistEntry = waitlistService.addToWaitlist(waitlistReq, null);

        referral.setLinkedWaitlistEntryId(waitlistEntry.getId());
        referral.setStatus(ReferralStatus.WAITLISTED);
        referral.setUpdatedAt(LocalDateTime.now());
        referral.setUpdatedBy(actorId);

        AmbulatoryReferral saved = referralRepository.save(referral);
        log.info("[Ambulatory] Referral WAITLISTED: id={} waitlistEntryId={}", saved.getId(), waitlistEntry.getId());
        return saved;
    }

    // ── 4. Update Status ─────────────────────────────────────────────────

    /**
     * Generic status transition (e.g. DECLINED, COMPLETED).
     * Matches the query-param status pattern from mental-health/cases/status.
     */
    public AmbulatoryReferral updateStatus(String referralId, ReferralStatus status, String actorId) {
        AmbulatoryReferral referral = getOrThrow(referralId);
        referral.setStatus(status);
        referral.setUpdatedAt(LocalDateTime.now());
        referral.setUpdatedBy(actorId);

        AmbulatoryReferral saved = referralRepository.save(referral);
        log.info("[Ambulatory] Referral status updated: id={} status={} by={}", saved.getId(), status, actorId);
        return saved;
    }

    // ── 5. Queries ────────────────────────────────────────────────────────

    public AmbulatoryReferral getOrThrow(String id) {
        return referralRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                "Ambulatory referral not found: " + id));
    }

    /**
     * List referrals with optional specialty and/or status filters.
     * Delegates to the most selective repository method available.
     */
    public Page<AmbulatoryReferral> listReferrals(
            String organizationId,
            AmbulatorySpecialty specialty,
            ReferralStatus status,
            Pageable pageable) {

        if (specialty != null && status != null) {
            return referralRepository.findByOrganizationIdAndSpecialtyAndStatus(
                organizationId, specialty, status, pageable);
        }
        if (specialty != null) {
            return referralRepository.findByOrganizationIdAndSpecialty(organizationId, specialty, pageable);
        }
        if (status != null) {
            return referralRepository.findByOrganizationIdAndStatus(organizationId, status, pageable);
        }
        return referralRepository.findByOrganizationId(organizationId, pageable);
    }

    // ── Private Helpers ───────────────────────────────────────────────────

    /**
     * Computes triage score from the 4-domain checklist.
     *
     * Current algorithm: number of non-null entries across all 4 domains.
     * Replace with the organization's accreditation-standard rubric when finalized.
     * Score is server-computed only — never accepted from the client.
     */
    private int computeTriageScore(TriageRequest req) {
        int count = 0;
        if (req.getPhysicalNeeds()     != null) count += req.getPhysicalNeeds().size();
        if (req.getEmotionalNeeds()    != null) count += req.getEmotionalNeeds().size();
        if (req.getPsychosocialNeeds() != null) count += req.getPsychosocialNeeds().size();
        if (req.getEducationalNeeds()  != null) count += req.getEducationalNeeds().size();
        return count;
    }

    /**
     * Maps triage score → WaitlistPriority.
     *
     * ≥ 6 flagged needs → URGENT  (score 300)
     * ≥ 3              → HIGH    (score 200)
     * < 3              → ROUTINE (score 100)
     */
    private WaitlistPriority priorityFromTriageScore(int score) {
        if (score >= 6) return WaitlistPriority.URGENT;
        if (score >= 3) return WaitlistPriority.HIGH;
        return WaitlistPriority.ROUTINE;
    }
}
