package com.healthcare.epcr.ed.controller;

import com.healthcare.epcr.ed.model.EdPatientRecord;
import com.healthcare.epcr.ed.service.EdTrackingService;
import com.healthcare.epcr.security.session.cache.CachedAuthSession;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ed")
@RequiredArgsConstructor
public class EdTrackingController {

    private final EdTrackingService edTrackingService;

    @GetMapping("/tracking-board")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'DENTIST', 'USER')")
    public ResponseEntity<List<EdPatientRecord>> getTrackingBoard(Authentication authentication) {
        CachedAuthSession session = getSession(authentication);
        return ResponseEntity.ok(edTrackingService.getActiveTrackingBoard(session.getOrganizationId()));
    }

    @PostMapping("/triage")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'NURSE', 'CLINICIAN')")
    public ResponseEntity<EdPatientRecord> triagePatient(@RequestBody EdPatientRecord record, Authentication authentication) {
        CachedAuthSession session = getSession(authentication);
        return ResponseEntity.ok(edTrackingService.triagePatient(record, session.getOrganizationId()));
    }

    @PutMapping("/{id}/disposition")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'NURSE', 'CLINICIAN')")
    public ResponseEntity<EdPatientRecord> updateDisposition(
            @PathVariable String id,
            @RequestBody Map<String, String> body,
            Authentication authentication) {
        CachedAuthSession session = getSession(authentication);
        String dispositionType = body.get("dispositionType");
        String notes = body.get("notes");
        return ResponseEntity.ok(edTrackingService.updateDisposition(id, dispositionType, notes, session.getOrganizationId()));
    }

    @PutMapping("/{id}/lwbs")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'NURSE', 'CLINICIAN')")
    public ResponseEntity<EdPatientRecord> markLwbs(@PathVariable String id, Authentication authentication) {
        CachedAuthSession session = getSession(authentication);
        return ResponseEntity.ok(edTrackingService.markLwbs(id, session.getOrganizationId()));
    }

    private CachedAuthSession getSession(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof CachedAuthSession session) {
            return session;
        }
        return CachedAuthSession.builder().organizationId("DEFAULT_ORG").build();
    }
}
