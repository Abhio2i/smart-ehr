package com.healthcare.epcr.ltc.controller;

import com.healthcare.epcr.ltc.entity.LtcFacility;
import com.healthcare.epcr.ltc.service.LtcResidentService;
import com.healthcare.epcr.security.session.cache.CachedAuthSession;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ltc/facilities")
@RequiredArgsConstructor
public class LtcFacilityController {

    private final LtcResidentService residentService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER')")
    public ResponseEntity<LtcFacility> create(
            @Valid @RequestBody LtcFacility facility,
            Authentication auth) {
        String orgId = currentOrgId(auth);
        return ResponseEntity.status(HttpStatus.CREATED).body(residentService.createFacility(facility, orgId));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER')")
    public ResponseEntity<List<LtcFacility>> list(Authentication auth) {
        String orgId = currentOrgId(auth);
        return ResponseEntity.ok(residentService.listFacilities(orgId));
    }

    private String currentOrgId(Authentication auth) {
        if (auth != null && auth.getDetails() instanceof CachedAuthSession session) {
            return session.getOrganizationId();
        }
        return "org123";
    }
}
