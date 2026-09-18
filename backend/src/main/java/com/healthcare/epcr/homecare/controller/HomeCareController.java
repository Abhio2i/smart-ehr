package com.healthcare.epcr.homecare.controller;

import com.healthcare.epcr.homecare.enums.ReferralStatus;
import com.healthcare.epcr.homecare.model.HomeCareReferral;
import com.healthcare.epcr.homecare.model.HomeCareVisit;
import com.healthcare.epcr.homecare.model.NurseCaseload;
import com.healthcare.epcr.homecare.service.HomeCareService;
import com.healthcare.epcr.security.AccessControlService;
import com.healthcare.epcr.user.model.User;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * HomeCareController — REST API for home & community care nurse dispatch module.
 *
 * Base URL: /api/homecare
 *
 * Endpoints:
 *  POST  /referrals                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              ccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc                       — Physician creates referral
 *  GET   /referrals                          — List referrals (org-scoped)
 *  GET   /referrals/{id}                     — Get single referral
 *  PUT   /referrals/{id}/status              — Update referral status
 *  GET   /dispatch-board                     — Dispatch board for a date/community
 *  POST  /visits/{id}/assign                 — Atomic nurse assignment
 *  POST  /visits/{id}/reassign               — Supervisor reassignment
 *  GET   /visits/{id}/suggest-nurses         — Smart nurse suggestions
 *  PUT   /visits/{id}/checkin                — Nurse field check-in
 *  PUT   /visits/{id}/checkout               — Nurse field checkout
 *  PUT   /visits/{id}/cancel                 — Cancel a visit
 *  GET   /nurses/{nurseId}/schedule          — Nurse's daily schedule
 *  POST  /caseloads                          — Create/update nurse caseload/territory
 *  GET   /caseloads                          — List caseloads for a date
 */
@RestController
@RequestMapping("/api/homecare")
@RequiredArgsConstructor
@Slf4j
public class HomeCareController {

    private final HomeCareService homeCareService;
    private final AccessControlService accessControlService;

    // ══════════════════════════════════════════════════════════════════════════
    //  REFERRAL ENDPOINTS
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * POST /api/homecare/referrals
     * Physician creates a home care referral for a patient.
     */
    @PostMapping("/referrals")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN')")
    public ResponseEntity<HomeCareReferral> createReferral(
            @RequestBody HomeCareReferral referral) {
        User currentUser = accessControlService.currentUser();
        if (referral.getReferringPhysicianId() == null || referral.getReferringPhysicianId().isBlank()) {
            referral.setReferringPhysicianId(currentUser.getId());
        }
        HomeCareReferral saved = homeCareService.createReferral(referral, currentUser.getOrganizationId());
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    /**
     * GET /api/homecare/referrals
     * List all referrals for the organization.
     */
    @GetMapping("/referrals")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN','PARAMEDIC')")
    public ResponseEntity<List<HomeCareReferral>> getReferrals(
            @RequestParam(required = false) String patientId) {
        User currentUser = accessControlService.currentUser();
        if (patientId != null && !patientId.isBlank()) {
            return ResponseEntity.ok(homeCareService.getReferralsByPatient(patientId));
        }
        return ResponseEntity.ok(homeCareService.getReferralsByOrg(currentUser.getOrganizationId()));
    }

    /**
     * PUT /api/homecare/referrals/{id}/status
     * Update referral status (PENDING → ACTIVE → COMPLETED / CANCELLED).
     */
    @PutMapping("/referrals/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN')")
    public ResponseEntity<HomeCareReferral> updateReferralStatus(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        String statusStr = body.get("status");
        ReferralStatus status = ReferralStatus.valueOf(statusStr.toUpperCase());
        return ResponseEntity.ok(homeCareService.updateReferralStatus(id, status));
    }

    /**
     * DELETE /api/homecare/referrals/{id}
     * Deletes a referral and all associated unstarted visits.
     */
    @DeleteMapping("/referrals/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN')")
    public ResponseEntity<Map<String, String>> deleteReferral(@PathVariable String id) {
        User currentUser = accessControlService.currentUser();
        homeCareService.deleteReferral(id, currentUser.getOrganizationId());
        return ResponseEntity.ok(Map.of("message", "Referral deleted successfully"));
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  DISPATCH BOARD
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * GET /api/homecare/dispatch-board?date=2026-07-14&community=Fort+Liard
     * Returns all visits for a date, optionally filtered by community.
     * Used by the dispatch board UI.
     */
    @GetMapping("/dispatch-board")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN','PARAMEDIC')")
    public ResponseEntity<List<HomeCareVisit>> getDispatchBoard(
            @RequestParam String date,
            @RequestParam(required = false) String community) {
        User currentUser = accessControlService.currentUser();
        List<HomeCareVisit> visits = homeCareService.getDispatchBoard(
                currentUser.getOrganizationId(), date, community);
        return ResponseEntity.ok(visits);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  VISIT ASSIGNMENT (ATOMIC)
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * POST /api/homecare/visits/{id}/assign
     * Atomically assign a nurse to an UNASSIGNED visit.
     * Concurrent requests for same visit: only one wins.
     */
    @PostMapping("/visits/{id}/assign")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<?> assignNurse(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        String nurseId = body.get("nurseId");
        String timeWindow = body.getOrDefault("timeWindow", "08:00-12:00");
        if (nurseId == null || nurseId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "nurseId is required"));
        }
        User currentUser = accessControlService.currentUser();
        try {
            HomeCareVisit updated = homeCareService.assignNurse(id, nurseId, timeWindow, currentUser.getOrganizationId());
            return ResponseEntity.ok(updated);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * POST /api/homecare/visits/{id}/reassign
     * Supervisor can reassign an already-assigned visit to a different nurse.
     */
    @PostMapping("/visits/{id}/reassign")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<?> reassignNurse(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        String newNurseId = body.get("nurseId");
        String timeWindow = body.getOrDefault("timeWindow", "08:00-12:00");
        if (newNurseId == null || newNurseId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "nurseId is required"));
        }
        User currentUser = accessControlService.currentUser();
        try {
            HomeCareVisit updated = homeCareService.reassignNurse(id, newNurseId, timeWindow, currentUser.getOrganizationId());
            return ResponseEntity.ok(updated);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * GET /api/homecare/visits/{id}/suggest-nurses
     * Returns smart nurse suggestions ranked by community match + caseload score.
     */
    @GetMapping("/visits/{id}/suggest-nurses")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<List<HomeCareService.NurseSuggestionDTO>> suggestNurses(
            @PathVariable String id) {
        User currentUser = accessControlService.currentUser();
        return ResponseEntity.ok(homeCareService.suggestNurses(id, currentUser.getOrganizationId()));
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  FIELD CHECK-IN / CHECK-OUT
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * PUT /api/homecare/visits/{id}/checkin
     * Nurse field check-in — marks visit as IN_PROGRESS.
     * Supports offline-created flag for PWA sync.
     */
    @PutMapping("/visits/{id}/checkin")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN','PARAMEDIC')")
    public ResponseEntity<HomeCareVisit> checkIn(
            @PathVariable String id,
            @RequestBody CheckInRequest req) {
        HomeCareVisit updated = homeCareService.checkIn(
                id,
                req.getCheckInAt() != null ? req.getCheckInAt() : Instant.now(),
                req.getLatitude(),
                req.getLongitude(),
                req.getOfflineCreated()
        );
        return ResponseEntity.ok(updated);
    }

    /**
     * PUT /api/homecare/visits/{id}/checkout
     * Nurse field checkout — marks visit COMPLETED, saves notes and vitals.
     */
    @PutMapping("/visits/{id}/checkout")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN','PARAMEDIC')")
    public ResponseEntity<HomeCareVisit> checkOut(
            @PathVariable String id,
            @RequestBody CheckOutRequest req) {
        HomeCareVisit updated = homeCareService.checkOut(
                id,
                req.getCheckOutAt() != null ? req.getCheckOutAt() : Instant.now(),
                req.getNotes(),
                req.getVitalsRecorded(),
                req.getOfflineCreated()
        );
        return ResponseEntity.ok(updated);
    }

    /**
     * PUT /api/homecare/visits/{id}/cancel
     * Cancel a visit.
     */
    @PutMapping("/visits/{id}/cancel")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<HomeCareVisit> cancelVisit(@PathVariable String id) {
        User currentUser = accessControlService.currentUser();
        return ResponseEntity.ok(homeCareService.cancelVisit(id, currentUser.getOrganizationId()));
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  NURSE SCHEDULE
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * GET /api/homecare/nurses/{nurseId}/schedule?date=2026-07-14
     * Returns a nurse's full daily schedule ordered by time window.
     */
    @GetMapping("/nurses/{nurseId}/schedule")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN','PARAMEDIC')")
    public ResponseEntity<List<HomeCareVisit>> getNurseSchedule(
            @PathVariable String nurseId,
            @RequestParam String date) {
        return ResponseEntity.ok(homeCareService.getNurseSchedule(nurseId, date));
    }

    /**
     * GET /api/homecare/patients/{patientId}/visits
     * Returns all visits for a specific patient.
     */
    @GetMapping("/patients/{patientId}/visits")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN','PARAMEDIC','PATIENT')")
    public ResponseEntity<List<HomeCareVisit>> getPatientVisits(@PathVariable String patientId) {
        return ResponseEntity.ok(homeCareService.getVisitsByPatient(patientId));
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  CASELOAD / TERRITORY MANAGEMENT
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * POST /api/homecare/caseloads
     * Create or update a nurse's caseload/territory for a specific date.
     */
    @PostMapping("/caseloads")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<NurseCaseload> upsertCaseload(@RequestBody NurseCaseload caseload) {
        User currentUser = accessControlService.currentUser();
        caseload.setOrganizationId(currentUser.getOrganizationId());
        return ResponseEntity.ok(homeCareService.upsertCaseload(caseload));
    }

    /**
     * GET /api/homecare/caseloads?date=2026-07-14
     * List all nurse caseloads for a specific date.
     */
    @GetMapping("/caseloads")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<List<NurseCaseload>> getCaseloads(
            @RequestParam String date) {
        User currentUser = accessControlService.currentUser();
        return ResponseEntity.ok(homeCareService.getCaseloadsByOrg(currentUser.getOrganizationId(), date));
    }

    /**
     * DELETE /api/homecare/caseloads/{id}
     * Deletes a nurse caseload allocation.
     */
    @DeleteMapping("/caseloads/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<Map<String, String>> deleteCaseload(@PathVariable String id) {
        User currentUser = accessControlService.currentUser();
        homeCareService.deleteCaseload(id, currentUser.getOrganizationId());
        return ResponseEntity.ok(Map.of("message", "Caseload allocation deleted successfully"));
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  REQUEST DTOs
    // ══════════════════════════════════════════════════════════════════════════

    @Data
    public static class CheckInRequest {
        private Instant checkInAt;
        private Double latitude;
        private Double longitude;
        private Boolean offlineCreated;
    }

    @Data
    public static class CheckOutRequest {
        private Instant checkOutAt;
        private String notes;
        private String vitalsRecorded;
        private Boolean offlineCreated;
    }
}
