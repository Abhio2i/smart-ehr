package com.healthcare.epcr.patienthistory.controller;

import com.healthcare.epcr.epcr.dto.MedicationSafetyAlert;
import com.healthcare.epcr.patienthistory.dto.CreateMedicationOrderRequest;
import com.healthcare.epcr.patienthistory.dto.MedicationOrderDTO;
import com.healthcare.epcr.patienthistory.service.IMedicationOrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/patients/{patientId}/medication-orders")
@RequiredArgsConstructor
@Tag(name = "Medication Orders", description = "Manage physician prescription orders and computerized order entry (CPOE) systems.")
@SecurityRequirement(name = "bearerAuth")
public class MedicationOrderController {

    private static final String READ_HISTORY_AUTH = "hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'VIEWER', 'QA_REVIEWER') "
            + "or authentication.principal instanceof T(com.healthcare.epcr.patient.security.PatientPrincipal)";
    
    private static final String MANAGE_HISTORY_AUTH = "hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN') "
            + "or authentication.principal instanceof T(com.healthcare.epcr.patient.security.PatientPrincipal)";

    private final IMedicationOrderService orderService;

    @GetMapping
    @PreAuthorize(READ_HISTORY_AUTH)
    @Operation(summary = "Get patient prescription orders", description = "Retrieves all medication prescription orders enrolled for a patient.")
    public ResponseEntity<List<MedicationOrderDTO>> getPatientOrders(
            @Parameter(description = "Patient ID") @PathVariable String patientId) {
        return ResponseEntity.ok(orderService.getPatientOrders(patientId));
    }

    @PostMapping
    @PreAuthorize(MANAGE_HISTORY_AUTH)
    @Operation(summary = "Create medication prescription order", description = "Signs a new active prescription order for a patient.")
    public ResponseEntity<MedicationOrderDTO> createOrder(
            @Parameter(description = "Patient ID") @PathVariable String patientId,
            @Valid @RequestBody CreateMedicationOrderRequest request) {
        MedicationOrderDTO created = orderService.createOrder(patientId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PostMapping("/{orderId}/discontinue")
    @PreAuthorize(MANAGE_HISTORY_AUTH)
    @Operation(summary = "Discontinue medication order", description = "Stops or cancels a running medication order.")
    public ResponseEntity<MedicationOrderDTO> discontinueOrder(
            @Parameter(description = "Patient ID") @PathVariable String patientId,
            @Parameter(description = "Order ID") @PathVariable String orderId,
            @RequestParam String reason) {
        return ResponseEntity.ok(orderService.discontinueOrder(patientId, orderId, reason));
    }

    @GetMapping("/check-safety")
    @PreAuthorize(READ_HISTORY_AUTH)
    @Operation(summary = "Check prescribing safety conflicts", description = "Cross-references a generic drug name against patient allergies and active medication conflicts.")
    public ResponseEntity<List<MedicationSafetyAlert>> checkOrderSafety(
            @Parameter(description = "Patient ID") @PathVariable String patientId,
            @RequestParam String genericName) {
        return ResponseEntity.ok(orderService.checkOrderSafety(patientId, genericName));
    }
}
