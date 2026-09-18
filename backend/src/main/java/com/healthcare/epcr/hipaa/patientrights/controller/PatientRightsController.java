package com.healthcare.epcr.hipaa.patientrights.controller;

import com.healthcare.epcr.epcr.model.PatientCareRecord;
import com.healthcare.epcr.hipaa.disclosure.model.DisclosureLog;
import com.healthcare.epcr.hipaa.patientrights.dto.CreateAmendmentRequest;
import com.healthcare.epcr.hipaa.patientrights.dto.CreateDisclosureRestrictionRequest;
import com.healthcare.epcr.hipaa.patientrights.model.AmendmentRequest;
import com.healthcare.epcr.hipaa.patientrights.model.DisclosureRestriction;
import com.healthcare.epcr.hipaa.patientrights.service.PatientRightsService;
import com.healthcare.epcr.patient.security.PatientPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/patient-portal")
@RequiredArgsConstructor
public class PatientRightsController {
    private final PatientRightsService service;
    private final com.healthcare.epcr.scheduling.repository.AppointmentRepository appointmentRepository;
    private final com.healthcare.epcr.scheduling.repository.TravelBundleRepository travelBundleRepository;
    private final com.healthcare.epcr.scheduling.service.PatientScheduleService scheduleService;

    private PatientPrincipal requirePrincipal(PatientPrincipal principal) {
        if (principal == null) {
            throw new IllegalArgumentException("Patient authentication required");
        }
        return principal;
    }

    @GetMapping("/records")
    public ResponseEntity<List<PatientCareRecord>> records(@AuthenticationPrincipal PatientPrincipal principal) {
        if (principal == null) {
            return ResponseEntity.ok(Collections.emptyList());
        }
        PatientPrincipal p = requirePrincipal(principal);
        return ResponseEntity.ok(service.getPatientPortalRecords(p.organizationId(), p.patientId()));
    }

    @GetMapping("/records/{recordId}")
    public ResponseEntity<PatientCareRecord> recordById(@AuthenticationPrincipal PatientPrincipal principal, @PathVariable String recordId) {
        PatientPrincipal p = requirePrincipal(principal);
        return ResponseEntity.ok(service.getPatientPortalRecordById(p.organizationId(), p.patientId(), recordId));
    }

    @PostMapping("/amendment-requests")
    public ResponseEntity<AmendmentRequest> createAmendment(@AuthenticationPrincipal PatientPrincipal principal, @Valid @RequestBody CreateAmendmentRequest request) {
        PatientPrincipal p = requirePrincipal(principal);
        request.setOrganizationId(p.organizationId());
        request.setPatientId(p.patientId());
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createAmendment(request));
    }

    @GetMapping("/amendment-requests")
    public ResponseEntity<List<AmendmentRequest>> amendmentRequests(@AuthenticationPrincipal PatientPrincipal principal) {
        if (principal == null) {
            return ResponseEntity.ok(Collections.emptyList());
        }
        PatientPrincipal p = requirePrincipal(principal);
        return ResponseEntity.ok(service.listAmendments(p.patientId()));
    }


    @PostMapping("/disclosure-restrictions")
    public ResponseEntity<DisclosureRestriction> createRestriction(@AuthenticationPrincipal PatientPrincipal principal, @Valid @RequestBody CreateDisclosureRestrictionRequest request) {
        PatientPrincipal p = requirePrincipal(principal);
        request.setOrganizationId(p.organizationId());
        request.setPatientId(p.patientId());
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createRestriction(request));
    }

    @GetMapping("/disclosure-restrictions")
    public ResponseEntity<List<DisclosureRestriction>> restrictions(@AuthenticationPrincipal PatientPrincipal principal) {
        if (principal == null) {
            return ResponseEntity.ok(Collections.emptyList());
        }
        PatientPrincipal p = requirePrincipal(principal);
        return ResponseEntity.ok(service.listRestrictions(p.patientId()));
    }


    @GetMapping("/disclosures")
    public ResponseEntity<List<DisclosureLog>> disclosures(@AuthenticationPrincipal PatientPrincipal principal) {
        if (principal == null) {
            return ResponseEntity.ok(Collections.emptyList());
        }
        PatientPrincipal p = requirePrincipal(principal);
        return ResponseEntity.ok(service.getPatientDisclosures(p.patientId()));
    }

    @GetMapping("/appointments")
    public ResponseEntity<List<com.healthcare.epcr.scheduling.model.Appointment>> appointments(
            @org.springframework.security.core.annotation.AuthenticationPrincipal PatientPrincipal principal) {
        if (principal == null) {
            return ResponseEntity.ok(java.util.Collections.emptyList());
        }
        return ResponseEntity.ok(appointmentRepository.findByPatientId(principal.patientId()));
    }

    @GetMapping("/travel-bundles")
    public ResponseEntity<List<com.healthcare.epcr.scheduling.model.TravelBundle>> travelBundles(
            @org.springframework.security.core.annotation.AuthenticationPrincipal PatientPrincipal principal) {
        if (principal == null) {
            return ResponseEntity.ok(java.util.Collections.emptyList());
        }
        return ResponseEntity.ok(travelBundleRepository.findByPatientId(principal.patientId()));
    }

    @PatchMapping("/appointments/{appointmentId}/cancel")
    public ResponseEntity<?> cancelAppointment(
            @org.springframework.security.core.annotation.AuthenticationPrincipal PatientPrincipal principal,
            @PathVariable String appointmentId) {
        try {
            PatientPrincipal p = requirePrincipal(principal);
            com.healthcare.epcr.scheduling.model.Appointment appt = appointmentRepository.findById(appointmentId)
                    .orElseThrow(() -> new IllegalArgumentException("Appointment not found: " + appointmentId));

            if (!appt.getPatientId().equals(p.patientId())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "Access denied. Can only cancel your own appointments."));
            }

            return ResponseEntity.ok(scheduleService.cancelAppointment(appointmentId));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
