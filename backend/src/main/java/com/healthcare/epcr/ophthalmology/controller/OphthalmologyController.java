package com.healthcare.epcr.ophthalmology.controller;

import com.healthcare.epcr.ophthalmology.dto.EyeExamRequest;
import com.healthcare.epcr.ophthalmology.dto.LinkOphthalmicProcedureRequest;
import com.healthcare.epcr.ophthalmology.entity.EyeExam;
import com.healthcare.epcr.ophthalmology.entity.OphthalmicProcedure;
import com.healthcare.epcr.ophthalmology.service.EyeExamService;
import com.healthcare.epcr.ophthalmology.service.OphthalmicProcedureService;
import com.healthcare.epcr.security.session.cache.CachedAuthSession;
import jakarta.validation.Valid;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Ophthalmology & Eye Team domain controller.
 *
 * Uses the same CachedAuthSession pattern as BedController, WaitlistController etc.
 */
@RestController
@RequestMapping("/api/ophthalmology")
@RequiredArgsConstructor
public class OphthalmologyController {

    private final EyeExamService eyeExamService;
    private final OphthalmicProcedureService procedureService;

    // ---------------------------------------------------------------
    // Eye Exams
    // ---------------------------------------------------------------

    @PostMapping("/exams")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC')")
    public ResponseEntity<?> createExam(
            @Valid @RequestBody EyeExamRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            Authentication authentication) {
        try {
            CachedAuthSession session = getSession(authentication);
            EyeExam exam = eyeExamService.createEyeExam(
                    request,
                    idempotencyKey,
                    session.getUserId(),
                    session.getEmail(),   // userName = email from session
                    session.getOrganizationId()
            );
            return ResponseEntity.status(HttpStatus.CREATED).body(exam);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/exams/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER')")
    public ResponseEntity<EyeExam> getExam(@PathVariable String id) {
        return ResponseEntity.ok(eyeExamService.getById(id));
    }

    @GetMapping("/patients/{patientId}/exams")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER')")
    public ResponseEntity<List<EyeExam>> getExamsByPatient(@PathVariable String patientId) {
        return ResponseEntity.ok(eyeExamService.getByPatient(patientId));
    }

    @GetMapping("/exams")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER')")
    public ResponseEntity<Page<EyeExam>> getExams(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication) {
        CachedAuthSession session = getSession(authentication);
        Page<EyeExam> result = eyeExamService.getByOrganization(
                session.getOrganizationId(), PageRequest.of(page, size));
        return ResponseEntity.ok(result);
    }

    // ---------------------------------------------------------------
    // Tele-ophthalmology review worklist
    // ---------------------------------------------------------------

    @GetMapping("/tele-review/pending")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHYSICIAN')")
    public ResponseEntity<List<EyeExam>> getPendingTeleReview() {
        return ResponseEntity.ok(eyeExamService.getPendingTeleReview());
    }

    @PutMapping("/exams/{id}/tele-review")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHYSICIAN')")
    public ResponseEntity<?> completeTeleReview(
            @PathVariable String id,
            @RequestBody TeleReviewRequest request,
            Authentication authentication) {
        try {
            CachedAuthSession session = getSession(authentication);
            EyeExam updated = eyeExamService.completeTeleReview(
                    id, session.getUserId(), request.getNotes());
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ---------------------------------------------------------------
    // Ophthalmic surgical procedure linking
    // ---------------------------------------------------------------

    @PostMapping("/procedures/link")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC')")
    public ResponseEntity<?> linkProcedure(
            @Valid @RequestBody LinkOphthalmicProcedureRequest request,
            Authentication authentication) {
        try {
            CachedAuthSession session = getSession(authentication);
            OphthalmicProcedure link = procedureService.link(
                    request, session.getOrganizationId());
            return ResponseEntity.status(HttpStatus.CREATED).body(link);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/patients/{patientId}/procedures")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER')")
    public ResponseEntity<List<OphthalmicProcedure>> getProceduresByPatient(@PathVariable String patientId) {
        return ResponseEntity.ok(procedureService.getByPatient(patientId));
    }

    // ---------------------------------------------------------------
    // Helpers — same pattern as BedController
    // ---------------------------------------------------------------

    private CachedAuthSession getSession(Authentication authentication) {
        if (authentication != null && authentication.getDetails() instanceof CachedAuthSession session) {
            return session;
        }
        throw new IllegalStateException("Authentication session not found.");
    }

    @Data
    public static class TeleReviewRequest {
        private String notes;
    }
}
