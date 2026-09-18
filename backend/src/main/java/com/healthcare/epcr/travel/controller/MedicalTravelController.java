package com.healthcare.epcr.travel.controller;

import com.healthcare.epcr.travel.model.AccommodationBooking;
import com.healthcare.epcr.travel.model.MedicalTravelRequest;
import com.healthcare.epcr.travel.model.TravelVoucher;
import com.healthcare.epcr.travel.service.MedicalTravelService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/travel")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Medical Travel Management", description = "Endpoints for flight booking, accommodation tracking, and patient travel vouchers")
public class MedicalTravelController {

    private final MedicalTravelService travelService;

    @PostMapping("/requests")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN')")
    @Operation(summary = "Submit a new patient medical travel request")
    public ResponseEntity<MedicalTravelRequest> createTravelRequest(@RequestBody MedicalTravelRequest request) {
        log.info("Request to create medical travel for Patient ID: {}", request.getPatientId());
        MedicalTravelRequest saved = travelService.createTravelRequest(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @GetMapping("/requests")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'QA_REVIEWER')")
    @Operation(summary = "List all patient travel requests, optionally filtered by patientId")
    public ResponseEntity<List<MedicalTravelRequest>> getAllTravelRequests(
            @RequestParam(required = false) String patientId) {
        log.info("Request to list travel requests, filter patientId: {}", patientId);
        List<MedicalTravelRequest> requests = travelService.getAllTravelRequests(patientId);
        return ResponseEntity.ok(requests);
    }

    @GetMapping("/requests/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'QA_REVIEWER')")
    @Operation(summary = "Get detailed travel request by ID")
    public ResponseEntity<MedicalTravelRequest> getTravelRequestById(@PathVariable String id) {
        log.info("Request to fetch travel request ID: {}", id);
        return travelService.getTravelRequestById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/requests/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN')")
    @Operation(summary = "Update status of a travel request (e.g. approve or book flights)")
    public ResponseEntity<MedicalTravelRequest> updateTravelRequestStatus(
            @PathVariable String id,
            @RequestParam String status,
            @RequestParam(required = false) String flightNumber,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime flightTime) {
        log.info("Request to update travel request ID: {} status to {}", id, status);
        try {
            MedicalTravelRequest updated = travelService.updateTravelRequestStatus(id, status, flightNumber, flightTime);
            return ResponseEntity.ok(updated);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/requests/{id}/accommodation")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN')")
    @Operation(summary = "Create an accommodation/lodging booking for a travel request")
    public ResponseEntity<AccommodationBooking> createAccommodation(
            @PathVariable String id,
            @RequestBody AccommodationBooking booking) {
        log.info("Request to book accommodation for travel request ID: {}", id);
        try {
            AccommodationBooking saved = travelService.createAccommodationBooking(id, booking);
            return ResponseEntity.status(HttpStatus.CREATED).body(saved);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/requests/{id}/accommodation")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'QA_REVIEWER')")
    @Operation(summary = "Get accommodation details for a travel request")
    public ResponseEntity<AccommodationBooking> getAccommodationByRequest(@PathVariable String id) {
        log.info("Request to get accommodation for travel request ID: {}", id);
        return ResponseEntity.ok(travelService.getAccommodationByTravelRequest(id).orElse(null));
    }

    @PostMapping("/requests/{id}/vouchers")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN')")
    @Operation(summary = "Submit a travel voucher/reimbursement request")
    public ResponseEntity<TravelVoucher> createVoucher(
            @PathVariable String id,
            @RequestParam Double amount,
            @RequestParam(required = false) String notes) {
        log.info("Request to generate travel voucher for request ID: {} amount: {}", id, amount);
        try {
            TravelVoucher saved = travelService.createTravelVoucher(id, amount, notes);
            return ResponseEntity.status(HttpStatus.CREATED).body(saved);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/requests/{id}/voucher")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'QA_REVIEWER')")
    @Operation(summary = "Get travel voucher details for a travel request")
    public ResponseEntity<TravelVoucher> getVoucherByRequest(@PathVariable String id) {
        log.info("Request to get voucher for travel request ID: {}", id);
        return ResponseEntity.ok(travelService.getVoucherByTravelRequest(id).orElse(null));
    }

    @PutMapping("/vouchers/{voucherId}/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN')")
    @Operation(summary = "Update travel voucher status (approve, reject, pay)")
    public ResponseEntity<TravelVoucher> updateVoucherStatus(
            @PathVariable String voucherId,
            @RequestParam String status,
            @RequestParam String approvedBy) {
        log.info("Request to update voucher ID: {} status to {}", voucherId, status);
        try {
            TravelVoucher updated = travelService.updateVoucherStatus(voucherId, status, approvedBy);
            return ResponseEntity.ok(updated);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    // ── ePCR Integration Endpoints ─────────────────────────────────────────────

    @PostMapping("/from-epcr/{epcrId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN')")
    @Operation(summary = "Create a travel request directly from an existing ePCR record",
               description = "Auto-populates patient ID, name, source/destination facility from the ePCR. Sets a bi-directional link between ePCR and travel request.")
    public ResponseEntity<MedicalTravelRequest> createTravelFromEpcr(
            @PathVariable String epcrId,
            @RequestParam(defaultValue = "FLIGHT") String transportType,
            @RequestParam(required = false) String sourceFacility,
            @RequestParam(required = false) String destinationFacility,
            @RequestParam(required = false) String travelDate) {
        log.info("Request to create travel from ePCR ID: {} transport: {} src: {} dest: {} date: {}", epcrId, transportType, sourceFacility, destinationFacility, travelDate);
        try {
            java.time.LocalDate parsedDate = null;
            if (travelDate != null && !travelDate.isBlank()) {
                parsedDate = java.time.LocalDate.parse(travelDate);
            }
            MedicalTravelRequest saved = travelService.createTravelRequestFromEpcr(epcrId, transportType, sourceFacility, destinationFacility, parsedDate);
            return ResponseEntity.status(HttpStatus.CREATED).body(saved);
        } catch (Exception e) {
            log.error("Failed to create travel from ePCR {}: {}", epcrId, e.getMessage());
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/link-epcr")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN')")
    @Operation(summary = "Link an existing travel request to an existing ePCR record (bi-directional)")
    public ResponseEntity<MedicalTravelRequest> linkTravelToEpcr(
            @RequestParam String travelRequestId,
            @RequestParam String epcrId) {
        log.info("Request to link Travel {} <-> ePCR {}", travelRequestId, epcrId);
        try {
            MedicalTravelRequest updated = travelService.linkTravelToEpcr(travelRequestId, epcrId);
            return ResponseEntity.ok(updated);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/by-epcr/{epcrId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'QA_REVIEWER')")
    @Operation(summary = "Get the travel request linked to a given ePCR record ID")
    public ResponseEntity<MedicalTravelRequest> getTravelByEpcr(@PathVariable String epcrId) {
        log.info("Request to get travel request for ePCR ID: {}", epcrId);
        return ResponseEntity.ok(travelService.getTravelByEpcrId(epcrId).orElse(null));
    }

    @DeleteMapping("/requests/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN')")
    @Operation(summary = "Delete a travel request and its associated accommodation and voucher")
    public ResponseEntity<Void> deleteTravelRequest(@PathVariable String id) {
        log.info("Request to delete travel request ID: {}", id);
        travelService.deleteTravelRequest(id);
        return ResponseEntity.noContent().build();
    }
}
