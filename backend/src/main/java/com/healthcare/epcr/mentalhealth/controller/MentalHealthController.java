package com.healthcare.epcr.mentalhealth.controller;

import com.healthcare.epcr.mentalhealth.dto.CreateMentalHealthCaseRequest;
import com.healthcare.epcr.mentalhealth.entity.MentalHealthCase;
import com.healthcare.epcr.mentalhealth.entity.MentalHealthSessionLog;
import com.healthcare.epcr.mentalhealth.service.MentalHealthService;
import com.healthcare.epcr.security.session.cache.CachedAuthSession;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/mental-health")
@RequiredArgsConstructor
@Tag(name = "Mental Health & Addictions", description = "Mental health intake, crisis risk triage, addictions recovery, and counseling session APIs.")
@SecurityRequirement(name = "bearerAuth")
public class MentalHealthController {

    private final MentalHealthService mentalHealthService;

    @PostMapping("/cases")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER')")
    @Operation(summary = "Open Mental Health Intake Case")
    public ResponseEntity<MentalHealthCase> createIntake(
            @RequestBody CreateMentalHealthCaseRequest req,
            Authentication auth) {
        String actorId = auth != null ? auth.getName() : "system";
        return ResponseEntity.status(HttpStatus.CREATED).body(mentalHealthService.createIntake(req, currentOrgId(auth), actorId));
    }

    @GetMapping("/cases")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER')")
    @Operation(summary = "List Mental Health Cases")
    public ResponseEntity<Page<MentalHealthCase>> listCases(
            @RequestParam(required = false) MentalHealthCase.CaseStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication auth) {
        return ResponseEntity.ok(mentalHealthService.listCases(currentOrgId(auth), status, PageRequest.of(page, size)));
    }

    @GetMapping("/cases/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER')")
    @Operation(summary = "Get Mental Health Case Details")
    public ResponseEntity<MentalHealthCase> getCase(@PathVariable String id) {
        return ResponseEntity.ok(mentalHealthService.getCase(id));
    }

    @PutMapping("/cases/{id}/recovery-plan")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER')")
    @Operation(summary = "Update Personal Recovery Plan")
    public ResponseEntity<MentalHealthCase> updateRecoveryPlan(
            @PathVariable String id,
            @RequestBody MentalHealthCase.RecoveryPlan recoveryPlan,
            Authentication auth) {
        String actorId = auth != null ? auth.getName() : "system";
        return ResponseEntity.ok(mentalHealthService.updateRecoveryPlan(id, recoveryPlan, actorId));
    }

    @PutMapping("/cases/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER')")
    @Operation(summary = "Update Case Status / Suicide Risk Level Triage")
    public ResponseEntity<MentalHealthCase> updateStatus(
            @PathVariable String id,
            @RequestParam MentalHealthCase.CaseStatus status,
            @RequestParam(required = false) MentalHealthCase.SuicideRiskLevel riskLevel,
            Authentication auth) {
        String actorId = auth != null ? auth.getName() : "system";
        return ResponseEntity.ok(mentalHealthService.updateStatus(id, status, riskLevel, actorId));
    }

    @PostMapping("/cases/{id}/sessions")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER')")
    @Operation(summary = "Log Therapy / Counseling Session")
    public ResponseEntity<MentalHealthSessionLog> logSession(
            @PathVariable String id,
            @RequestBody MentalHealthSessionLog session,
            Authentication auth) {
        String actorId = auth != null ? auth.getName() : "system";
        return ResponseEntity.status(HttpStatus.CREATED).body(mentalHealthService.logSession(id, session, actorId));
    }

    @GetMapping("/cases/{id}/sessions")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER')")
    @Operation(summary = "List Therapy Sessions for Case")
    public ResponseEntity<Page<MentalHealthSessionLog>> listSessions(
            @PathVariable String id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(mentalHealthService.listSessions(id, PageRequest.of(page, size)));
    }

    private String currentOrgId(Authentication auth) {
        if (auth != null && auth.getDetails() instanceof CachedAuthSession session) {
            return session.getOrganizationId();
        }
        return "org123";
    }
}
