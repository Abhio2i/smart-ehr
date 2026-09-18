package com.healthcare.epcr.dental.controller;

import com.healthcare.epcr.dental.dto.DentalProgramVisitRequest;
import com.healthcare.epcr.dental.dto.ToothEntryRequest;
import com.healthcare.epcr.dental.dto.TreatmentRequest;
import com.healthcare.epcr.dental.entity.DentalChart;
import com.healthcare.epcr.dental.entity.DentalProgramVisit;
import com.healthcare.epcr.dental.service.DentalChartService;
import com.healthcare.epcr.dental.service.DentalProgramVisitService;
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

import java.time.LocalDate;
import java.util.List;

/**
 * Oral & Dental Health domain controller.
 *
 * Uses CachedAuthSession for user/org details matching OphthalmologyController pattern.
 */
@RestController
@RequestMapping("/api/dental")
@RequiredArgsConstructor
public class DentalController {

    private final DentalChartService dentalChartService;
    private final DentalProgramVisitService programVisitService;

    // ---------------------------------------------------------------
    // Dental Chart
    // ---------------------------------------------------------------

    @GetMapping("/patients/{patientId}/chart")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'DENTIST', 'USER')")
    public ResponseEntity<DentalChart> getChart(@PathVariable String patientId, Authentication authentication) {
        CachedAuthSession session = getSession(authentication);
        return ResponseEntity.ok(dentalChartService.getOrCreateChart(patientId, session != null ? session.getOrganizationId() : null, null));
    }

    @PutMapping("/patients/{patientId}/chart")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'DENTIST', 'USER')")
    public ResponseEntity<DentalChart> saveFullChart(
            @PathVariable String patientId,
            @RequestBody DentalChart incoming,
            Authentication authentication) {

        CachedAuthSession session = getSession(authentication);
        DentalChart updated = dentalChartService.saveFullChart(
                patientId, incoming,
                session != null ? session.getOrganizationId() : null,
                null);
        return ResponseEntity.ok(updated);
    }

    @GetMapping("/charts")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'DENTIST', 'USER')")
    public ResponseEntity<Page<DentalChart>> listCharts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication) {

        CachedAuthSession session = getSession(authentication);
        Page<DentalChart> result = dentalChartService.getByOrganization(
                session.getOrganizationId(), PageRequest.of(page, size));
        return ResponseEntity.ok(result);
    }

    @PutMapping("/patients/{patientId}/tooth-entries")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'DENTIST', 'USER')")
    public ResponseEntity<DentalChart> upsertToothEntry(
            @PathVariable String patientId,
            @Valid @RequestBody ToothEntryRequest request,
            Authentication authentication) {

        CachedAuthSession session = getSession(authentication);
        DentalChart updated = dentalChartService.upsertToothEntry(
                patientId, request,
                session.getOrganizationId(),
                null);
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/patients/{patientId}/treatments")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'DENTIST', 'USER')")
    public ResponseEntity<DentalChart> addTreatment(
            @PathVariable String patientId,
            @Valid @RequestBody TreatmentRequest request,
            Authentication authentication) {

        CachedAuthSession session = getSession(authentication);
        DentalChart updated = dentalChartService.addTreatment(
                patientId, request,
                session.getUserId(),
                session.getEmail(),
                session.getOrganizationId(),
                null);
        return ResponseEntity.status(HttpStatus.CREATED).body(updated);
    }

    // ---------------------------------------------------------------
    // School-Based Dental Program Visits
    // ---------------------------------------------------------------

    @PostMapping("/program-visits")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'DENTIST', 'USER')")
    public ResponseEntity<DentalProgramVisit> createProgramVisit(
            @Valid @RequestBody DentalProgramVisitRequest request,
            Authentication authentication) {

        CachedAuthSession session = getSession(authentication);
        DentalProgramVisit visit = programVisitService.createVisit(
                request,
                session.getUserId(),
                session.getEmail(),
                session.getOrganizationId());
        return ResponseEntity.status(HttpStatus.CREATED).body(visit);
    }

    @GetMapping("/program-visits")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'DENTIST', 'USER')")
    public ResponseEntity<Page<DentalProgramVisit>> listProgramVisits(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication) {

        CachedAuthSession session = getSession(authentication);
        Page<DentalProgramVisit> result = programVisitService.getByOrganization(
                session.getOrganizationId(), PageRequest.of(page, size));
        return ResponseEntity.ok(result);
    }

    @GetMapping("/program-visits/range")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER', 'NURSE', 'CLINICIAN', 'DENTIST', 'USER')")
    public ResponseEntity<List<DentalProgramVisit>> getProgramVisitsByRange(
            @RequestParam LocalDate start,
            @RequestParam LocalDate end,
            Authentication authentication) {

        CachedAuthSession session = getSession(authentication);
        return ResponseEntity.ok(programVisitService.getByDateRange(
                session.getOrganizationId(), start, end));
    }

    // ---------------------------------------------------------------
    // Session Helper — matches OphthalmologyController / BedController
    // ---------------------------------------------------------------

    private CachedAuthSession getSession(Authentication authentication) {
        if (authentication != null && authentication.getDetails() instanceof CachedAuthSession session) {
            return session;
        }
        throw new IllegalStateException("Authentication session not found.");
    }
}
