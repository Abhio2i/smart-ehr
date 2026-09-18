package com.healthcare.epcr.surgical.controller;

import com.healthcare.epcr.security.AccessControlService;
import com.healthcare.epcr.surgical.model.PreOpChecklist;
import com.healthcare.epcr.surgical.service.SurgicalCareService;
import com.healthcare.epcr.user.model.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * PreOpChecklistController — WHO Surgical Safety Checklist per case.
 *
 * Base URL: /api/surgical/cases/{caseId}/preop-checklist
 *
 * Endpoints:
 *   POST   /                  — Initialize checklist for a case
 *   GET    /                  — Get current checklist state
 *   PUT    /sign-in           — Complete Sign-In phase (auto-advances case to CHECKED_IN)
 *   PUT    /time-out          — Complete Time-Out phase (auto-advances to PRE_OP_VERIFIED)
 *   PUT    /sign-out          — Complete Sign-Out phase (post-surgery)
 *
 * Business rule: PRE_OP_VERIFIED → IN_PROGRESS is blocked unless
 * signIn.completed AND timeOut.completed are true (enforced in SurgicalCareService).
 */
@RestController
@RequestMapping("/api/surgical/cases/{caseId}/preop-checklist")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Surgical — PreOp Checklist", description = "WHO Surgical Safety Checklist (Sign-In / Time-Out / Sign-Out)")
public class PreOpChecklistController {

    private final SurgicalCareService surgicalCareService;
    private final AccessControlService accessControlService;

    // ── INIT ─────────────────────────────────────────────────────────────────

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN','PARAMEDIC')")
    @Operation(summary = "Initialize WHO Safety Checklist for a surgical case")
    public ResponseEntity<?> initChecklist(@PathVariable String caseId) {
        User currentUser = accessControlService.currentUser();
        try {
            PreOpChecklist created = surgicalCareService.initChecklist(caseId, currentUser.getOrganizationId());
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        }
    }

    // ── GET ──────────────────────────────────────────────────────────────────

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN','PARAMEDIC')")
    @Operation(summary = "Get PreOp checklist for a case")
    public ResponseEntity<?> getChecklist(@PathVariable String caseId) {
        User currentUser = accessControlService.currentUser();
        try {
            return ResponseEntity.ok(
                    surgicalCareService.getChecklist(caseId, currentUser.getOrganizationId()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    // ── SIGN-IN ───────────────────────────────────────────────────────────────

    /**
     * PUT /api/surgical/cases/{caseId}/preop-checklist/sign-in
     * Complete Sign-In phase. Auto-advances case to CHECKED_IN.
     */
    @PutMapping("/sign-in")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN','PARAMEDIC')")
    @Operation(summary = "Complete Sign-In phase (before anesthesia induction)")
    public ResponseEntity<?> completeSignIn(
            @PathVariable String caseId,
            @RequestBody PreOpChecklist.SignInPhase signIn) {
        User currentUser = accessControlService.currentUser();
        try {
            PreOpChecklist updated = surgicalCareService.completeSignIn(
                    caseId, signIn, currentUser.getId(), currentUser.getOrganizationId());
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    // ── TIME-OUT ──────────────────────────────────────────────────────────────

    /**
     * PUT /api/surgical/cases/{caseId}/preop-checklist/time-out
     * Complete Time-Out phase (team huddle before incision).
     * Auto-advances case to PRE_OP_VERIFIED.
     */
    @PutMapping("/time-out")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN','PARAMEDIC')")
    @Operation(summary = "Complete Time-Out phase (before surgical incision)")
    public ResponseEntity<?> completeTimeOut(
            @PathVariable String caseId,
            @RequestBody PreOpChecklist.TimeOutPhase timeOut) {
        User currentUser = accessControlService.currentUser();
        try {
            PreOpChecklist updated = surgicalCareService.completeTimeOut(
                    caseId, timeOut, currentUser.getId(), currentUser.getOrganizationId());
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        }
    }

    // ── SIGN-OUT ──────────────────────────────────────────────────────────────

    /**
     * PUT /api/surgical/cases/{caseId}/preop-checklist/sign-out
     * Complete Sign-Out phase (before patient leaves OR).
     */
    @PutMapping("/sign-out")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN','PARAMEDIC')")
    @Operation(summary = "Complete Sign-Out phase (before patient leaves OR)")
    public ResponseEntity<?> completeSignOut(
            @PathVariable String caseId,
            @RequestBody PreOpChecklist.SignOutPhase signOut) {
        User currentUser = accessControlService.currentUser();
        try {
            PreOpChecklist updated = surgicalCareService.completeSignOut(
                    caseId, signOut, currentUser.getId(), currentUser.getOrganizationId());
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }
}
