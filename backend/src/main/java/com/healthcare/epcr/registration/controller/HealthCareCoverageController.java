package com.healthcare.epcr.registration.controller;

import com.healthcare.epcr.registration.dto.CreateOrUpdateCoverageRequest;
import com.healthcare.epcr.registration.dto.HealthCareCoverageDTO;
import com.healthcare.epcr.registration.service.IHealthCareCoverageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/patients/{patientId}/registration/coverage")
@RequiredArgsConstructor
@Tag(name = "Healthcare Registration", description = "Manage patient provincial/territorial coverage eligibility registration (Manage Patient Access domain).")
@SecurityRequirement(name = "bearerAuth")
public class HealthCareCoverageController {

    private static final String READ_HISTORY_AUTH = "hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'VIEWER', 'QA_REVIEWER') "
            + "or authentication.principal instanceof T(com.healthcare.epcr.patient.security.PatientPrincipal)";
    
    private static final String MANAGE_HISTORY_AUTH = "hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN') "
            + "or authentication.principal instanceof T(com.healthcare.epcr.patient.security.PatientPrincipal)";

    private final IHealthCareCoverageService coverageService;

    @GetMapping
    @PreAuthorize(READ_HISTORY_AUTH)
    @Operation(summary = "Get patient healthcare coverage registration", description = "Retrieves the active health care plan and coverage status for the patient.")
    public ResponseEntity<HealthCareCoverageDTO> getCoverage(
            @Parameter(description = "Patient ID") @PathVariable String patientId) {
        return ResponseEntity.ok(coverageService.getCoverageByPatientId(patientId));
    }


    @PostMapping
    @PreAuthorize(MANAGE_HISTORY_AUTH)
    @Operation(summary = "Create or update patient healthcare coverage registration", description = "Enrolls or updates details of a patient's provincial/territorial health plan.")
    public ResponseEntity<HealthCareCoverageDTO> createOrUpdateCoverage(
            @Parameter(description = "Patient ID") @PathVariable String patientId,
            @Valid @RequestBody CreateOrUpdateCoverageRequest request) {
        HealthCareCoverageDTO created = coverageService.createOrUpdateCoverage(patientId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping("/active")
    @PreAuthorize(READ_HISTORY_AUTH)
    @Operation(summary = "Get active health coverage status", description = "Checks whether the patient's coverage is active and eligible (fails if expired).")
    public ResponseEntity<HealthCareCoverageDTO> getActiveCoverage(
            @Parameter(description = "Patient ID") @PathVariable String patientId) {
        return ResponseEntity.ok(coverageService.getActiveEligibility(patientId));
    }

    @PostMapping("/verify")
    @PreAuthorize(MANAGE_HISTORY_AUTH)
    @Operation(summary = "Verify patient coverage eligibility", description = "Triggers a simulated query validation to the territorial health coverage registry.")
    public ResponseEntity<HealthCareCoverageDTO> verifyCoverage(
            @Parameter(description = "Patient ID") @PathVariable String patientId) {
        return ResponseEntity.ok(coverageService.verifyCoverage(patientId));
    }

    @DeleteMapping
    @PreAuthorize(MANAGE_HISTORY_AUTH)
    @Operation(summary = "Delete patient healthcare coverage registration", description = "Removes the patient's enrolled health card/coverage registry document.")
    public ResponseEntity<Void> deleteCoverage(
            @Parameter(description = "Patient ID") @PathVariable String patientId) {
        coverageService.deleteCoverage(patientId);
        return ResponseEntity.noContent().build();
    }
}
