package com.healthcare.epcr.surgical.controller;

import com.healthcare.epcr.security.AccessControlService;
import com.healthcare.epcr.surgical.model.AnesthesiaRecord;
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
 * AnesthesiaController — intra-operative anesthesia log management.
 *
 * Base URL: /api/surgical/cases/{caseId}/anesthesia
 *
 * Endpoints:
 *   POST   /              — Create anesthesia record for a case
 *   GET    /              — Get anesthesia record
 *   PUT    /vitals        — Append a vitals snapshot (intra-op, rolling)
 *   PUT    /medications   — Append a medication administration event
 *   PUT    /complete      — Mark anesthesia record complete (locks further edits)
 */
@RestController
@RequestMapping("/api/surgical/cases/{caseId}/anesthesia")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Surgical — Anesthesia", description = "Intra-operative anesthesia log: vitals timeline + medications")
public class AnesthesiaController {

    private final SurgicalCareService surgicalCareService;
    private final AccessControlService accessControlService;

    // ── CREATE ────────────────────────────────────────────────────────────────

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN')")
    @Operation(summary = "Create anesthesia record for a surgical case")
    public ResponseEntity<?> createRecord(
            @PathVariable String caseId,
            @RequestBody AnesthesiaRecord record) {
        User currentUser = accessControlService.currentUser();
        try {
            AnesthesiaRecord saved = surgicalCareService.createAnesthesiaRecord(
                    caseId, record, currentUser.getOrganizationId());
            return ResponseEntity.status(HttpStatus.CREATED).body(saved);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        }
    }

    // ── READ ──────────────────────────────────────────────────────────────────

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN','PARAMEDIC')")
    @Operation(summary = "Get anesthesia record for a surgical case")
    public ResponseEntity<?> getRecord(@PathVariable String caseId) {
        User currentUser = accessControlService.currentUser();
        try {
            return ResponseEntity.ok(
                    surgicalCareService.getAnesthesiaRecord(caseId, currentUser.getOrganizationId()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    // ── APPEND VITALS ─────────────────────────────────────────────────────────

    /**
     * PUT /api/surgical/cases/{caseId}/anesthesia/vitals
     * Appends a single intra-operative vitals snapshot.
     * Called every 5–15 minutes during active surgery.
     */
    @PutMapping("/vitals")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN','PARAMEDIC')")
    @Operation(summary = "Append intra-op vitals snapshot to anesthesia record")
    public ResponseEntity<?> appendVitals(
            @PathVariable String caseId,
            @RequestBody AnesthesiaRecord.VitalsEntry entry) {
        User currentUser = accessControlService.currentUser();
        try {
            return ResponseEntity.ok(
                    surgicalCareService.appendVitals(caseId, entry, currentUser.getOrganizationId()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    // ── APPEND MEDICATION ─────────────────────────────────────────────────────

    /**
     * PUT /api/surgical/cases/{caseId}/anesthesia/medications
     * Appends a medication administration event to the record.
     */
    @PutMapping("/medications")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN','PARAMEDIC')")
    @Operation(summary = "Append medication administration event to anesthesia record")
    public ResponseEntity<?> appendMedication(
            @PathVariable String caseId,
            @RequestBody AnesthesiaRecord.MedicationEntry med) {
        User currentUser = accessControlService.currentUser();
        try {
            return ResponseEntity.ok(
                    surgicalCareService.appendMedication(caseId, med, currentUser.getOrganizationId()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    // ── COMPLETE ──────────────────────────────────────────────────────────────

    /**
     * PUT /api/surgical/cases/{caseId}/anesthesia/complete
     * Marks anesthesia record as complete (locked — no further vitals/meds appended).
     * Sets emergenceTime, captures final notes, complications, airway management.
     */
    @PutMapping("/complete")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN')")
    @Operation(summary = "Mark anesthesia record complete (locks record for editing)")
    public ResponseEntity<?> completeRecord(
            @PathVariable String caseId,
            @RequestBody AnesthesiaRecord updates) {
        User currentUser = accessControlService.currentUser();
        try {
            return ResponseEntity.ok(
                    surgicalCareService.completeAnesthesiaRecord(
                            caseId, updates, currentUser.getOrganizationId()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }
}
