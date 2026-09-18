package com.healthcare.epcr.hipaa.consent.controller;

import com.healthcare.epcr.hipaa.consent.dto.CreateConsentRequest;
import com.healthcare.epcr.hipaa.consent.model.PatientConsent;
import com.healthcare.epcr.hipaa.consent.service.PatientConsentService;
import com.healthcare.epcr.security.AccessControlService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/patients/{patientId}/consents")
@RequiredArgsConstructor
public class PatientConsentController {
    private final PatientConsentService service;
    private final AccessControlService accessControlService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN')")
    public ResponseEntity<PatientConsent> create(
            @PathVariable String patientId,
            @RequestParam String organizationId,
            @Valid @RequestBody CreateConsentRequest request) {
        String actorUserId = accessControlService.currentUser().getId();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.create(patientId, organizationId, actorUserId, request));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN','VIEWER')")
    public ResponseEntity<List<PatientConsent>> list(@PathVariable String patientId) {
        return ResponseEntity.ok(service.listByPatient(patientId));
    }

    @GetMapping("/{consentId}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN','VIEWER')")
    public ResponseEntity<PatientConsent> get(@PathVariable String patientId, @PathVariable String consentId) {
        return ResponseEntity.ok(service.getById(patientId, consentId));
    }


    @PostMapping("/{consentId}/revoke")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','VIEWER')")
    public ResponseEntity<PatientConsent> revoke(@PathVariable String patientId, @PathVariable String consentId) {
        return ResponseEntity.ok(service.revoke(patientId, consentId));
    }

}
