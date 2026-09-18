package com.healthcare.epcr.hipaa.consent.controller;

import com.healthcare.epcr.hipaa.consent.model.PatientConsent;
import com.healthcare.epcr.hipaa.consent.service.LockboxService;
import com.healthcare.epcr.security.AccessControlService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * TPH PIM-1.1 — Patient Lockbox REST API.
 *
 * Base path: /api/patients/{patientId}/lockbox
 */
@RestController
@RequestMapping("/api/patients/{patientId}/lockbox")
@RequiredArgsConstructor
public class LockboxController {

    private final LockboxService lockboxService;
    private final AccessControlService accessControlService;

    /**
     * GET /api/patients/{patientId}/lockbox
     * Returns current lockbox settings for this patient.
     * Accessible by the patient themselves, admin, or physician.
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN','PATIENT')")
    public ResponseEntity<?> getLockbox(@PathVariable String patientId) {
        return lockboxService.getLockboxConsent(patientId)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.ok(Map.of(
                        "patientId", patientId,
                        "lockboxActive", false,
                        "lockboxCategories", List.of(),
                        "overrideGrantedUserIds", List.of()
                )));
    }


    /**
     * PUT /api/patients/{patientId}/lockbox
     * Patient updates their lockbox categories.
     *
     * Body: { "categories": ["HIV_STATUS", "MENTAL_HEALTH"] }
     *
     * Accessible by the patient themselves or ADMIN.
     */
    @PutMapping
    @PreAuthorize("hasAnyRole('ADMIN','PATIENT')")
    public ResponseEntity<PatientConsent> setLockbox(
            @PathVariable String patientId,
            @RequestBody Map<String, List<String>> body) {
        String actorId = accessControlService.currentUser().getId();
        List<String> categories = body.getOrDefault("categories", List.of());
        PatientConsent updated = lockboxService.setLockbox(patientId, categories, actorId);
        return ResponseEntity.ok(updated);
    }

    /**
     * POST /api/patients/{patientId}/lockbox/override-grant
     * Patient grants a specific clinician permission to bypass their lockbox.
     *
     * Body: { "clinicianUserId": "abc123" }
     *
     * Accessible by patient or ADMIN.
     */
    @PostMapping("/override-grant")
    @PreAuthorize("hasAnyRole('ADMIN','PATIENT')")
    public ResponseEntity<PatientConsent> grantOverride(
            @PathVariable String patientId,
            @RequestBody Map<String, String> body) {
        String clinicianUserId = body.get("clinicianUserId");
        if (clinicianUserId == null || clinicianUserId.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        String actorId = accessControlService.currentUser().getId();
        PatientConsent updated = lockboxService.grantOverride(patientId, clinicianUserId, actorId);
        return ResponseEntity.ok(updated);
    }

    /**
     * DELETE /api/patients/{patientId}/lockbox/override-grant/{userId}
     * Patient revokes a previously granted override from a clinician.
     *
     * Accessible by patient or ADMIN.
     */
    @DeleteMapping("/override-grant/{userId}")
    @PreAuthorize("hasAnyRole('ADMIN','PATIENT')")
    public ResponseEntity<PatientConsent> revokeOverride(
            @PathVariable String patientId,
            @PathVariable String userId) {
        String actorId = accessControlService.currentUser().getId();
        PatientConsent updated = lockboxService.revokeOverride(patientId, userId, actorId);
        return ResponseEntity.ok(updated);
    }
}
