package com.healthcare.epcr.rehab.controller;

import com.healthcare.epcr.rehab.dto.*;
import com.healthcare.epcr.rehab.entity.*;
import com.healthcare.epcr.rehab.service.RehabServicesService;
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
@RequestMapping("/api/rehab")
public class RehabController {

    @Autowired
    private RehabServicesService rehabService;

    // ── Treatment Plans ───────────────────────────────────────────────────────
    @PostMapping("/treatment-plans")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER', 'THERAPIST')")
    public ResponseEntity<RehabTreatmentPlan> createPlan(
            @RequestBody CreateRehabTreatmentPlanRequest request,
            Authentication authentication) {
        String orgId = "org123";
        String user = authentication != null ? authentication.getName() : "TherapistUser";
        if (authentication != null && authentication.getPrincipal() instanceof CachedAuthSession session) {
            orgId = session.getOrganizationId();
        }
        return ResponseEntity.ok(rehabService.createPlan(request, orgId, user));
    }

    @GetMapping("/treatment-plans")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER', 'THERAPIST')")
    public ResponseEntity<Page<RehabTreatmentPlan>> getPlans(
            @RequestParam(required = false) String patientId,
            @RequestParam(required = false) String discipline,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(rehabService.getPlans(patientId, discipline, status, PageRequest.of(page, size)));
    }

    @GetMapping("/treatment-plans/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER', 'THERAPIST')")
    public ResponseEntity<RehabTreatmentPlan> getPlanById(@PathVariable String id) {
        return rehabService.getPlanById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/treatment-plans/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER', 'THERAPIST')")
    public ResponseEntity<RehabTreatmentPlan> updateStatus(
            @PathVariable String id,
            @RequestParam String status,
            Authentication authentication) {
        String user = authentication != null ? authentication.getName() : "TherapistUser";
        return ResponseEntity.ok(rehabService.updateStatus(id, status, user));
    }

    @PutMapping("/treatment-plans/{id}/goals")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER', 'THERAPIST')")
    public ResponseEntity<RehabTreatmentPlan> updateGoals(
            @PathVariable String id,
            @RequestBody List<String> goals,
            Authentication authentication) {
        String user = authentication != null ? authentication.getName() : "TherapistUser";
        return ResponseEntity.ok(rehabService.updateGoals(id, goals, user));
    }

    // ── Sessions ──────────────────────────────────────────────────────────────
    @PostMapping("/treatment-plans/{id}/sessions")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER', 'THERAPIST')")
    public ResponseEntity<RehabSession> logSession(
            @PathVariable String id,
            @RequestBody LogRehabSessionRequest request,
            Authentication authentication) {
        String user = authentication != null ? authentication.getName() : "TherapistUser";
        return ResponseEntity.ok(rehabService.logSession(id, request, user));
    }

    @GetMapping("/treatment-plans/{id}/sessions")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER', 'THERAPIST')")
    public ResponseEntity<Page<RehabSession>> getSessionsForPlan(
            @PathVariable String id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(rehabService.getSessionsForPlan(id, PageRequest.of(page, size)));
    }

    // ── FIM Assessments ───────────────────────────────────────────────────────
    @PostMapping("/treatment-plans/{id}/fim-assessments")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER', 'THERAPIST')")
    public ResponseEntity<RehabFimAssessment> recordFimAssessment(
            @PathVariable String id,
            @RequestBody RecordFimAssessmentRequest request,
            Authentication authentication) {
        String user = authentication != null ? authentication.getName() : "TherapistUser";
        return ResponseEntity.ok(rehabService.recordFimAssessment(id, request, user));
    }

    @GetMapping("/treatment-plans/{id}/fim-assessments")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER', 'THERAPIST')")
    public ResponseEntity<List<RehabFimAssessment>> getFimAssessmentsForPlan(@PathVariable String id) {
        return ResponseEntity.ok(rehabService.getFimAssessmentsForPlan(id));
    }

    // ── Child Development Assessments ─────────────────────────────────────────
    @PostMapping("/development-assessments")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER', 'THERAPIST')")
    public ResponseEntity<RehabDevelopmentAssessment> recordDevelopmentAssessment(
            @RequestBody RecordDevelopmentAssessmentRequest request,
            Authentication authentication) {
        String orgId = "org123";
        String user = authentication != null ? authentication.getName() : "TherapistUser";
        if (authentication != null && authentication.getPrincipal() instanceof CachedAuthSession session) {
            orgId = session.getOrganizationId();
        }
        return ResponseEntity.ok(rehabService.recordDevelopmentAssessment(request, orgId, user));
    }

    @GetMapping("/development-assessments")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'USER', 'THERAPIST')")
    public ResponseEntity<Page<RehabDevelopmentAssessment>> getDevelopmentAssessments(
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(rehabService.getDevelopmentAssessments(type, PageRequest.of(page, size)));
    }
}
