package com.healthcare.epcr.cfs.controller;

import com.healthcare.epcr.cfs.dto.*;
import com.healthcare.epcr.cfs.entity.*;
import com.healthcare.epcr.cfs.service.ChildFamilyServicesService;
import com.healthcare.epcr.security.session.cache.CachedAuthSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cfs")
public class ChildFamilyServicesController {

    @Autowired
    private ChildFamilyServicesService cfsService;

    // ── Cases ─────────────────────────────────────────────────────────────────
    @PostMapping("/cases")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER')")
    public ResponseEntity<ChildFamilyCase> createCase(
            @RequestBody CreateChildFamilyCaseRequest request,
            Authentication authentication) {
        String orgId = "org123";
        String workerId = authentication != null ? authentication.getName() : "SocialWorker1";
        if (authentication != null && authentication.getPrincipal() instanceof CachedAuthSession session) {
            orgId = session.getOrganizationId();
        }
        return ResponseEntity.ok(cfsService.createCase(request, orgId, workerId));
    }

    @GetMapping("/cases")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER')")
    public ResponseEntity<Page<ChildFamilyCase>> getCases(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(cfsService.getCases(status, PageRequest.of(page, size)));
    }

    @GetMapping("/cases/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER')")
    public ResponseEntity<ChildFamilyCase> getCaseById(@PathVariable String id) {
        return cfsService.getCaseById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/cases/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER')")
    public ResponseEntity<ChildFamilyCase> updateCaseStatus(
            @PathVariable String id,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String riskLevel) {
        return ResponseEntity.ok(cfsService.updateCaseStatus(id, status, riskLevel));
    }

    // ── Foster Homes & Placements ─────────────────────────────────────────────
    @PostMapping("/foster-homes")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER')")
    public ResponseEntity<FosterHome> registerFosterHome(
            @RequestBody RegisterFosterHomeRequest request,
            Authentication authentication) {
        String orgId = "org123";
        if (authentication != null && authentication.getPrincipal() instanceof CachedAuthSession session) {
            orgId = session.getOrganizationId();
        }
        return ResponseEntity.ok(cfsService.registerFosterHome(request, orgId));
    }

    @GetMapping("/foster-homes")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER')")
    public ResponseEntity<List<FosterHome>> getAllFosterHomes() {
        return ResponseEntity.ok(cfsService.getAllFosterHomes());
    }

    @PostMapping("/cases/{caseId}/placements")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER')")
    public ResponseEntity<ChildPlacement> createPlacement(
            @PathVariable String caseId,
            @RequestBody CreatePlacementRequest request,
            Authentication authentication) {
        String workerId = authentication != null ? authentication.getName() : "SocialWorker1";
        return ResponseEntity.ok(cfsService.createPlacement(caseId, request, workerId));
    }

    @GetMapping("/cases/{caseId}/placements")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER')")
    public ResponseEntity<List<ChildPlacement>> getPlacementsForCase(@PathVariable String caseId) {
        return ResponseEntity.ok(cfsService.getPlacementsForCase(caseId));
    }

    // ── Adoptions ─────────────────────────────────────────────────────────────
    @PostMapping("/adoptions")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER')")
    public ResponseEntity<AdoptionCase> createAdoption(@RequestBody CreateAdoptionRequest request) {
        return ResponseEntity.ok(cfsService.createAdoption(request));
    }

    @GetMapping("/adoptions")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER')")
    public ResponseEntity<Page<AdoptionCase>> getAdoptions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(cfsService.getAdoptions(PageRequest.of(page, size)));
    }
}
