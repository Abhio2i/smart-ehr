package com.healthcare.epcr.patient.controller;

import com.healthcare.epcr.patient.dto.DuplicateCandidate;
import com.healthcare.epcr.patient.dto.DuplicateCheckRequest;
import com.healthcare.epcr.patient.dto.DuplicateMergeRequest;
import com.healthcare.epcr.patient.dto.DuplicateOverrideRequest;
import com.healthcare.epcr.patient.service.DuplicateDetectionService;
import com.healthcare.epcr.patient.service.DuplicateMergeService;
import com.healthcare.epcr.user.model.User;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/patients")
@RequiredArgsConstructor
@Tag(name = "Duplicate Client Management", description = "Endpoints for checking, overriding, and merging duplicate client records (TPH TB-DQA 1.1).")
@SecurityRequirement(name = "bearerAuth")
public class DuplicateController {

    private final DuplicateDetectionService duplicateDetectionService;
    private final DuplicateMergeService duplicateMergeService;

    @PostMapping("/duplicate-check")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'NURSE')")
    @Operation(summary = "Check for duplicate patient candidates", description = "Runs Soundex phonetic matching, DOB, and phone checks to surface potential duplicate client records.")
    public ResponseEntity<List<DuplicateCandidate>> checkDuplicates(
            @RequestBody DuplicateCheckRequest request,
            @AuthenticationPrincipal User currentUser) {
        String orgId = currentUser != null ? currentUser.getOrganizationId() : "DEFAULT";
        List<DuplicateCandidate> candidates = duplicateDetectionService.checkDuplicates(
                request.getPatientName(),
                request.getDateOfBirth(),
                request.getPhone(),
                orgId
        );
        return ResponseEntity.ok(candidates);
    }

    @PostMapping("/{patientId}/override-duplicate")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'NURSE')")
    @Operation(summary = "Permanently override duplicate warning", description = "Logs user override reason in immutable audit log when creating a patient despite duplicate warning.")
    public ResponseEntity<Map<String, String>> overrideDuplicate(
            @PathVariable String patientId,
            @RequestBody DuplicateOverrideRequest request,
            @AuthenticationPrincipal User currentUser) {
        String userId = currentUser != null ? currentUser.getId() : "SYSTEM";
        String orgId = currentUser != null ? currentUser.getOrganizationId() : "DEFAULT";

        duplicateMergeService.logDuplicateOverride(
                patientId,
                request.getFlaggedPatientId(),
                request.getReason(),
                userId,
                orgId
        );

        return ResponseEntity.ok(Map.of("message", "Duplicate warning overridden and logged successfully."));
    }

    @PostMapping("/merge")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    @Operation(summary = "Merge secondary duplicate patient into primary patient", description = "Re-links all ePCR records and TB cases from secondary patient into primary patient, then deactivates secondary patient.")
    public ResponseEntity<Map<String, String>> mergePatients(
            @RequestBody DuplicateMergeRequest request,
            @AuthenticationPrincipal User currentUser) {
        String userId = currentUser != null ? currentUser.getId() : "SYSTEM";
        String orgId = currentUser != null ? currentUser.getOrganizationId() : "DEFAULT";

        duplicateMergeService.mergePatients(
                request.getPrimaryPatientId(),
                request.getSecondaryPatientId(),
                request.getReason(),
                userId,
                orgId
        );

        return ResponseEntity.ok(Map.of("message", "Patient records merged successfully."));
    }
}
