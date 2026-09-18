package com.healthcare.epcr.ambulatory.controller;

import com.healthcare.epcr.ambulatory.dto.CreateReferralRequest;
import com.healthcare.epcr.ambulatory.dto.TriageRequest;
import com.healthcare.epcr.ambulatory.entity.AmbulatoryReferral;
import com.healthcare.epcr.ambulatory.entity.AmbulatoryReferral.ReferralStatus;
import com.healthcare.epcr.ambulatory.entity.AmbulatorySpecialty;
import com.healthcare.epcr.ambulatory.service.AmbulatoryReferralService;
import com.healthcare.epcr.security.session.cache.CachedAuthSession;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * REST controller for Ambulatory Referrals (RFP Roadmap 2.10).
 *
 * API surface (6 endpoints):
 *   POST   /api/ambulatory/referrals                    create referral
 *   GET    /api/ambulatory/referrals                    list (specialty/status filters)
 *   GET    /api/ambulatory/referrals/{id}               get single
 *   PUT    /api/ambulatory/referrals/{id}/triage        record 4-domain checklist
 *   POST   /api/ambulatory/referrals/{id}/waitlist      promote to WaitlistEntry
 *   PUT    /api/ambulatory/referrals/{id}/status        generic status update (e.g. DECLINED)
 *
 *   GET    /api/ambulatory/specialties                  list of 17 supported specialties
 *
 * Auth & orgId extraction: identical to MentalHealthController —
 * CachedAuthSession from auth.getDetails(), fallback "org123" for local dev.
 */
@RestController
@RequestMapping("/api/ambulatory")
@RequiredArgsConstructor
@Tag(
    name = "Ambulatory Referrals",
    description = "Specialist referral management: 11 permanent + 6 visiting specialties. " +
                  "Covers GP/paramedic-initiated referrals, 4-domain triage checklists, " +
                  "and automated promotion to the Waitlist module."
)
@SecurityRequirement(name = "bearerAuth")
public class AmbulatoryReferralController {

    private final AmbulatoryReferralService referralService;

    // ── Create ────────────────────────────────────────────────────────────

    @PostMapping("/referrals")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'NURSE', 'CLINICIAN', 'USER')")
    @Operation(summary = "Submit a New Ambulatory Referral")
    public ResponseEntity<AmbulatoryReferral> create(
            @Valid @RequestBody CreateReferralRequest request,
            Authentication auth) {
        String actorId = auth != null ? auth.getName() : "system";
        AmbulatoryReferral referral = referralService.create(request, currentOrgId(auth), actorId);
        return ResponseEntity.status(HttpStatus.CREATED).body(referral);
    }

    // ── List ──────────────────────────────────────────────────────────────

    @GetMapping("/referrals")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'NURSE', 'CLINICIAN', 'QA_REVIEWER', 'USER')")
    @Operation(summary = "List Ambulatory Referrals (filterable by specialty and status)")
    public ResponseEntity<Page<AmbulatoryReferral>> list(
            @RequestParam(required = false) AmbulatorySpecialty specialty,
            @RequestParam(required = false) ReferralStatus status,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication auth) {
        return ResponseEntity.ok(
            referralService.listReferrals(currentOrgId(auth), specialty, status, PageRequest.of(page, size))
        );
    }

    // ── Get Single ────────────────────────────────────────────────────────

    @GetMapping("/referrals/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'NURSE', 'CLINICIAN', 'QA_REVIEWER', 'USER')")
    @Operation(summary = "Get Ambulatory Referral Details")
    public ResponseEntity<AmbulatoryReferral> get(@PathVariable String id) {
        return ResponseEntity.ok(referralService.getOrThrow(id));
    }

    // ── Triage ────────────────────────────────────────────────────────────

    @PutMapping("/referrals/{id}/triage")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'NURSE', 'CLINICIAN')")
    @Operation(summary = "Record 4-Domain Triage Checklist (physical / emotional / psychosocial / educational)")
    public ResponseEntity<AmbulatoryReferral> triage(
            @PathVariable String id,
            @RequestBody TriageRequest request,
            Authentication auth) {
        String actorId = auth != null ? auth.getName() : "system";
        return ResponseEntity.ok(referralService.recordTriage(id, request, actorId));
    }

    // ── Promote to Waitlist ───────────────────────────────────────────────

    @PostMapping("/referrals/{id}/waitlist")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'NURSE', 'CLINICIAN')")
    @Operation(summary = "Promote Triaged Referral to Waitlist (delegates to existing WaitlistService)")
    public ResponseEntity<AmbulatoryReferral> promoteToWaitlist(
            @PathVariable String id,
            Authentication auth) {
        String actorId = auth != null ? auth.getName() : "system";
        return ResponseEntity.ok(referralService.promoteToWaitlist(id, actorId));
    }

    // ── Status Update ─────────────────────────────────────────────────────

    @PutMapping("/referrals/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'NURSE', 'CLINICIAN')")
    @Operation(summary = "Update Referral Status (e.g. DECLINED, COMPLETED) — query param pattern")
    public ResponseEntity<AmbulatoryReferral> updateStatus(
            @PathVariable String id,
            @RequestParam ReferralStatus status,
            Authentication auth) {
        String actorId = auth != null ? auth.getName() : "system";
        return ResponseEntity.ok(referralService.updateStatus(id, status, actorId));
    }

    // ── Specialties Lookup ────────────────────────────────────────────────

    @GetMapping("/specialties")
    @Operation(summary = "List All 17 Supported Ambulatory Specialties (for frontend dropdown)")
    public ResponseEntity<AmbulatorySpecialty[]> specialties() {
        return ResponseEntity.ok(AmbulatorySpecialty.values());
    }

    // ── Private Helpers ───────────────────────────────────────────────────

    /**
     * Extracts organizationId from the CachedAuthSession stored in auth.getDetails().
     * Identical to MentalHealthController.currentOrgId() and LtcController.currentOrgId().
     */
    private String currentOrgId(Authentication auth) {
        if (auth != null && auth.getDetails() instanceof CachedAuthSession session) {
            return session.getOrganizationId();
        }
        return "org123"; // local dev / test fallback
    }
}
