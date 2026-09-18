package com.healthcare.epcr.ltc.controller;

import com.healthcare.epcr.ltc.dto.AdmitResidentRequest;
import com.healthcare.epcr.ltc.dto.CarePlanUpdateRequest;
import com.healthcare.epcr.ltc.entity.LtcResident;
import com.healthcare.epcr.ltc.service.LtcResidentService;
import com.healthcare.epcr.security.session.cache.CachedAuthSession;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ltc/residents")
@RequiredArgsConstructor
public class LtcResidentController {

    private final LtcResidentService residentService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER')")
    public ResponseEntity<LtcResident> admit(
            @Valid @RequestBody AdmitResidentRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            Authentication auth) {

        String orgId = currentOrgId(auth);
        String actorId = auth != null ? auth.getName() : "system";
        return ResponseEntity.status(HttpStatus.CREATED).body(residentService.admit(request, orgId, actorId));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER')")
    public ResponseEntity<Page<LtcResident>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication auth) {

        String orgId = currentOrgId(auth);
        return ResponseEntity.ok(residentService.listResidents(orgId, PageRequest.of(page, size)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER')")
    public ResponseEntity<LtcResident> get(@PathVariable String id) {
        return ResponseEntity.ok(residentService.getOrThrow(id));
    }

    @PutMapping("/{id}/care-plan")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER')")
    public ResponseEntity<LtcResident> updateCarePlan(
            @PathVariable String id,
            @RequestBody CarePlanUpdateRequest request,
            Authentication auth) {
        String actorId = auth != null ? auth.getName() : "system";
        return ResponseEntity.ok(residentService.updateCarePlan(id, request, actorId));
    }

    // matches PUT /api/beds/{bedId}/status?status= style — query param, not body
    @PutMapping("/{id}/discharge")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER')")
    public ResponseEntity<LtcResident> discharge(
            @PathVariable String id,
            @RequestParam(required = false) LtcResident.ResidentStatus finalStatus,
            Authentication auth) {
        String actorId = auth != null ? auth.getName() : "system";
        return ResponseEntity.ok(residentService.discharge(id, finalStatus, actorId));
    }

    // matches PUT /api/beds/{bedId}/assign?patientId=&patientName= style
    @PutMapping("/{id}/transfer-bed")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER')")
    public ResponseEntity<LtcResident> transferBed(
            @PathVariable String id,
            @RequestParam String newBedId,
            @RequestParam String newFacilityId,
            Authentication auth) {
        String actorId = auth != null ? auth.getName() : "system";
        return ResponseEntity.ok(residentService.transferBed(id, newBedId, newFacilityId, actorId));
    }

    @PostMapping("/{id}/activities")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER')")
    public ResponseEntity<com.healthcare.epcr.ltc.entity.LtcActivityLog> logActivity(
            @PathVariable String id,
            @RequestBody com.healthcare.epcr.ltc.entity.LtcActivityLog log,
            Authentication auth) {
        String actorId = auth != null ? auth.getName() : "system";
        return ResponseEntity.status(HttpStatus.CREATED).body(residentService.logActivity(id, log, actorId));
    }

    @GetMapping("/{id}/activities")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER')")
    public ResponseEntity<Page<com.healthcare.epcr.ltc.entity.LtcActivityLog>> listActivities(
            @PathVariable String id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(residentService.listActivityLogs(id, PageRequest.of(page, size)));
    }

    private String currentOrgId(Authentication auth) {
        if (auth != null && auth.getDetails() instanceof CachedAuthSession session) {
            return session.getOrganizationId();
        }
        return "org123";
    }
}
