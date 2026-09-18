package com.healthcare.epcr.surgical.controller;

import com.healthcare.epcr.security.AccessControlService;
import com.healthcare.epcr.surgical.model.SurgicalCase;
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

import java.util.List;
import java.util.Map;

/**
 * SurgicalCaseController — manage surgical case bookings.
 *
 * Base URL: /api/surgical/cases
 *
 * Endpoints:
 *   POST   /                  — Book a new surgical case (atomic, overlap-checked)
 *   GET    /                  — List cases (?date= &?orId= &?patientId=)
 *   GET    /{id}              — Get a single case
 *   PUT    /{id}/status       — Transition case status (state-machine enforced)
 *   DELETE /{id}              — Cancel a case
 */
@RestController
@RequestMapping("/api/surgical/cases")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Surgical — Cases", description = "Surgical case booking and lifecycle management")
public class SurgicalCaseController {

    private final SurgicalCareService surgicalCareService;
    private final AccessControlService accessControlService;

    // ── BOOK ─────────────────────────────────────────────────────────────────

    /**
     * POST /api/surgical/cases
     * Atomically books a new surgical case.
     * Returns 409 if OR is already booked in the requested time window.
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN')")
    @Operation(summary = "Book a new surgical case (atomic, overlap-checked)")
    public ResponseEntity<?> bookCase(@RequestBody SurgicalCareService.BookCaseRequest req) {
        User currentUser = accessControlService.currentUser();
        try {
            SurgicalCase saved = surgicalCareService.bookCase(
                    req, currentUser.getOrganizationId(), currentUser.getId());
            return ResponseEntity.status(HttpStatus.CREATED).body(saved);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ── READ ─────────────────────────────────────────────────────────────────

    /**
     * GET /api/surgical/cases?date=2026-07-14&orId=...&patientId=...
     * Returns cases filtered by date, OR, or patient.
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN','PARAMEDIC')")
    @Operation(summary = "List surgical cases (filterable by date, OR, or patient)")
    public ResponseEntity<List<SurgicalCase>> getCases(
            @RequestParam(required = false) String date,
            @RequestParam(required = false) String orId,
            @RequestParam(required = false) String patientId) {
        User currentUser = accessControlService.currentUser();
        return ResponseEntity.ok(
                surgicalCareService.getCases(currentUser.getOrganizationId(), date, orId, patientId));
    }

    @GetMapping("/search")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN','PARAMEDIC')")
    @Operation(summary = "Search surgical cases by case number, patient, surgeon, or procedure name")
    public ResponseEntity<List<SurgicalCase>> searchCases(
            @RequestParam(required = false) String query,
            @RequestParam(defaultValue = "20") int limit) {
        User currentUser = accessControlService.currentUser();
        return ResponseEntity.ok(
                surgicalCareService.searchCases(currentUser.getOrganizationId(), query, limit));
    }

    /**
     * GET /api/surgical/cases/{id}
     * Get a single surgical case by ID.
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN','PARAMEDIC')")
    @Operation(summary = "Get a single surgical case")
    public ResponseEntity<?> getCaseById(@PathVariable String id) {
        User currentUser = accessControlService.currentUser();
        try {
            return ResponseEntity.ok(
                    surgicalCareService.getCaseById(id, currentUser.getOrganizationId()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    // ── STATUS TRANSITION ────────────────────────────────────────────────────

    /**
     * PUT /api/surgical/cases/{id}/status
     * Transition case to next status. State machine enforced.
     * Returns 409 if transition is invalid (e.g. IN_PROGRESS without PreOp complete).
     */
    @PutMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN','PARAMEDIC')")
    @Operation(summary = "Transition surgical case status (state machine enforced)")
    public ResponseEntity<?> updateStatus(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        String newStatus = body.get("status");
        if (newStatus == null || newStatus.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "status field is required."));
        }
        User currentUser = accessControlService.currentUser();
        try {
            SurgicalCase updated = surgicalCareService.transitionStatus(
                    id, newStatus, currentUser.getOrganizationId());
            return ResponseEntity.ok(updated);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ── DELETE / PURGE ───────────────────────────────────────────────────────

    /**
     * DELETE /api/surgical/cases/{id}
     * Delete/purge a surgical case record.
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN')")
    @Operation(summary = "Delete / purge a surgical case record")
    public ResponseEntity<Map<String, String>> deleteCase(@PathVariable String id) {
        User currentUser = accessControlService.currentUser();
        try {
            surgicalCareService.deleteCase(id, currentUser.getOrganizationId());
            return ResponseEntity.ok(Map.of("message", "Surgical case record deleted successfully."));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        }
    }
}
