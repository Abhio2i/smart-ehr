package com.healthcare.epcr.patient.controller;

import com.healthcare.epcr.patient.dto.PatientSearchResultDTO;
import com.healthcare.epcr.patient.service.PatientAdminService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/patients")
@RequiredArgsConstructor
@Tag(name = "Admin Patients", description = "Admin portal patient lookup APIs used by patient selectors and history workflows.")
@SecurityRequirement(name = "bearerAuth")
public class PatientAdminController {
    private final PatientAdminService patientAdminService;

    @GetMapping("/search")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER')")
    @Operation(
            summary = "Search patients",
            description = "Lookup for patient dropdowns and history workflows. Empty query returns accessible patients up to the limit. Non-empty query searches patient ID, name, email, and phone."
    )
    public ResponseEntity<List<PatientSearchResultDTO>> searchPatientsByPhone(
            @RequestParam(required = false) String phone,
            @RequestParam(required = false) String query,
            @RequestParam(required = false) Integer limit) {
        String resolvedQuery = query != null ? query : phone;
        return ResponseEntity.ok(patientAdminService.searchByPhone(resolvedQuery, limit));
    }
}
