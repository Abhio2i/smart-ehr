package com.healthcare.epcr.bed.controller;

import com.healthcare.epcr.bed.dto.CreateBedRequest;
import com.healthcare.epcr.bed.model.Bed;
import com.healthcare.epcr.bed.service.BedService;
import com.healthcare.epcr.security.session.cache.CachedAuthSession;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/beds")
@RequiredArgsConstructor
public class BedController {

    private final BedService bedService;

    // ── CREATE ────────────────────────────────────────────────────────────────

    /**
     * Register a new bed.
     * Admin / Manager / Paramedic can create beds for their facility.
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC')")
    public ResponseEntity<?> createBed(
            @Valid @RequestBody CreateBedRequest request,
            Authentication authentication) {
        try {
            CachedAuthSession session = getSession(authentication);
            Bed created = bedService.createBed(request, session.getUserId(), session.getOrganizationId());
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ── READ ─────────────────────────────────────────────────────────────────

    /**
     * List beds — org-scoped for Manager/Paramedic, full access for Admin.
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'QA_REVIEWER')")
    public ResponseEntity<List<Bed>> getBeds(
            @RequestParam(required = false) String facility,
            @RequestParam(required = false) String ward,
            Authentication authentication) {
        CachedAuthSession session = getSession(authentication);
        return ResponseEntity.ok(
                bedService.getBeds(session.getRole(), session.getOrganizationId(), facility, ward));
    }

    // ── STATS ─────────────────────────────────────────────────────────────────

    @GetMapping("/stats")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'QA_REVIEWER')")
    public ResponseEntity<Map<String, Object>> getCapacityStats(Authentication authentication) {
        CachedAuthSession session = getSession(authentication);
        return ResponseEntity.ok(
                bedService.getCapacityStats(session.getRole(), session.getOrganizationId()));
    }

    @PutMapping("/{id}/assign")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN')")
    public ResponseEntity<?> assignBed(
            @PathVariable String id,
            @RequestParam String patientId,
            @RequestParam String patientName,
            @RequestParam(required = false) Integer allottedDays,
            Authentication authentication) {
        try {
            CachedAuthSession session = getSession(authentication);
            return ResponseEntity.ok(bedService.assignBed(id, patientId, patientName, allottedDays, session.getUserId()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ── VACATE ────────────────────────────────────────────────────────────────

    @PutMapping("/{id}/vacate")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN')")
    public ResponseEntity<?> vacateBed(@PathVariable String id) {
        try {
            return ResponseEntity.ok(bedService.vacateBed(id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}/test-expire")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN')")
    public ResponseEntity<?> testExpire(@PathVariable String id) {
        try {
            return ResponseEntity.ok(bedService.simulateExpiry(id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ── STATUS UPDATE ─────────────────────────────────────────────────────────

    @PutMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN')")
    public ResponseEntity<?> updateBedStatus(
            @PathVariable String id,
            @RequestParam String status) {
        try {
            return ResponseEntity.ok(bedService.updateBedStatus(id, status));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ── DELETE ────────────────────────────────────────────────────────────────

    /**
     * Permanently remove a bed (must be AVAILABLE or MAINTENANCE — cannot delete OCCUPIED beds).
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC')")
    public ResponseEntity<?> deleteBed(
            @PathVariable String id,
            Authentication authentication) {
        try {
            CachedAuthSession session = getSession(authentication);
            bedService.deleteBed(id, session.getRole(), session.getOrganizationId());
            return ResponseEntity.ok(Map.of("message", "Bed deleted successfully."));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ── HELPER ────────────────────────────────────────────────────────────────

    private CachedAuthSession getSession(Authentication authentication) {
        if (authentication != null && authentication.getDetails() instanceof CachedAuthSession session) {
            return session;
        }
        throw new IllegalStateException("Authentication session not found.");
    }
}
