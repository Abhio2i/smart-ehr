package com.healthcare.epcr.patienthistory.controller;

import com.healthcare.epcr.patienthistory.dto.PatientOverviewRouteDTO;
import com.healthcare.epcr.patienthistory.service.PatientOverviewRoutingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/patients/{patientId}/overview-route")
@RequiredArgsConstructor
@Tag(name = "Patient Overview Routing", description = "Routes patient overview screens by incident type.")
@SecurityRequirement(name = "bearerAuth")
public class PatientOverviewRoutingController {
    private static final String READ_HISTORY_AUTH = "hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'VIEWER', 'QA_REVIEWER') "
            + "or authentication.principal instanceof T(com.healthcare.epcr.patient.security.PatientPrincipal)";

    private final PatientOverviewRoutingService patientOverviewRoutingService;

    @GetMapping
    @PreAuthorize(READ_HISTORY_AUTH)
    @Operation(summary = "Resolve overview route", description = "Returns which frontend overview variant should render for an incident type.")
    public ResponseEntity<PatientOverviewRouteDTO> getRoute(
            @PathVariable String patientId,
            @RequestParam String incidentType) {
        return ResponseEntity.ok(patientOverviewRoutingService.getRoute(patientId, incidentType));
    }

    @GetMapping("/records/{recordId}")
    @PreAuthorize(READ_HISTORY_AUTH)
    @Operation(summary = "Resolve overview route by ePCR record", description = "Reads the ePCR incident type and returns the frontend overview route.")
    public ResponseEntity<PatientOverviewRouteDTO> getRouteByRecord(
            @PathVariable String patientId,
            @PathVariable String recordId) {
        return ResponseEntity.ok(patientOverviewRoutingService.getRouteByRecord(recordId));
    }
}
