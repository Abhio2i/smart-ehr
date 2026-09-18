package com.healthcare.epcr.hl7.controller;

import com.healthcare.epcr.epcr.dto.PatientCareRecordDTO;
import com.healthcare.epcr.epcr.service.IPatientCareRecordService;
import com.healthcare.epcr.hl7.model.Hospital;
import com.healthcare.epcr.hl7.repository.HospitalRepository;
import com.healthcare.epcr.hl7.service.Hl7OutboundSender;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/hl7")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "HL7 Integration & Debugging", description = "Endpoints for managing HL7 routing configurations and inspecting translations")
public class Hl7Controller {

    private final IPatientCareRecordService recordService;
    private final Hl7OutboundSender hl7OutboundSender;
    private final HospitalRepository hospitalRepository;

    @GetMapping(value = "/records/{id}", produces = MediaType.TEXT_PLAIN_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER', 'VIEWER')")
    @Operation(summary = "Translate an ePCR record to its raw HL7 v2.4 representation")
    public ResponseEntity<String> translateRecordToHl7(@PathVariable String id) {
        log.info("Request to translate ePCR record ID {} to HL7", id);
        return recordService.getRecordById(id)
                .map(dto -> {
                    try {
                        String hl7Message = hl7OutboundSender.buildAdmitMessageString(dto);
                        return ResponseEntity.ok(hl7Message);
                    } catch (Exception e) {
                        log.error("Failed to serialize record {} to HL7", id, e);
                        return ResponseEntity.internalServerError().body("Error encoding HL7: " + e.getMessage());
                    }
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/hospitals")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'QA_REVIEWER', 'VIEWER')")
    @Operation(summary = "List all registered hospital HL7 routing destinations")
    public ResponseEntity<List<Hospital>> getAllHospitals() {
        log.info("Request to fetch all hospital HL7 routing destinations");
        return ResponseEntity.ok(hospitalRepository.findAll());
    }

    @PostMapping("/hospitals")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Register a new hospital HL7 routing destination (Admin only)")
    public ResponseEntity<Hospital> registerHospital(@RequestBody Hospital hospital) {
        log.info("Request by Admin to register new hospital HL7 target: {}", hospital.getName());
        if (hospital.getName() == null || hospital.getName().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        Hospital saved = hospitalRepository.save(hospital);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/hospitals/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Update an existing hospital HL7 routing destination (Admin only)")
    public ResponseEntity<Hospital> updateHospital(@PathVariable String id, @RequestBody Hospital hospitalUpdates) {
        log.info("Request by Admin to update hospital HL7 target ID: {}", id);
        return hospitalRepository.findById(id)
                .map(existing -> {
                    if (hospitalUpdates.getName() != null) existing.setName(hospitalUpdates.getName());
                    if (hospitalUpdates.getHl7Ip() != null) existing.setHl7Ip(hospitalUpdates.getHl7Ip());
                    if (hospitalUpdates.getHl7Port() != null) existing.setHl7Port(hospitalUpdates.getHl7Port());
                    if (hospitalUpdates.getActive() != null) existing.setActive(hospitalUpdates.getActive());
                    Hospital saved = hospitalRepository.save(existing);
                    return ResponseEntity.ok(saved);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/hospitals/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Delete/unregister a hospital HL7 routing destination (Admin only)")
    public ResponseEntity<Void> deleteHospital(@PathVariable String id) {
        log.info("Request by Admin to delete hospital HL7 target ID: {}", id);
        if (hospitalRepository.existsById(id)) {
            hospitalRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }

    @PostMapping("/records/{id}/resend")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER')")
    @Operation(summary = "Manually re-send/sync an ePCR record's HL7 ADT message to the destination hospital")
    public ResponseEntity<Void> resendHl7Message(@PathVariable String id) {
        log.info("Request to manually re-send/sync HL7 message for record ID {}", id);
        return recordService.getRecordById(id)
                .map(dto -> {
                    hl7OutboundSender.sendPatientAdmitMessage(dto);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  ORU^R01 — Observation Results (Vital Signs)
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping(value = "/records/{id}/observation", produces = MediaType.TEXT_PLAIN_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER', 'VIEWER')")
    @Operation(
        summary = "Preview HL7 ORU^R01 Observation Result message",
        description = "Translates an ePCR record's vital signs into a raw HL7 v2.4 ORU^R01 message string for inspection (LIS integration)."
    )
    public ResponseEntity<String> previewObservationMessage(@PathVariable String id) {
        log.info("Request to preview HL7 ORU^R01 observation message for record ID {}", id);
        return recordService.getRecordById(id)
                .map(dto -> {
                    try {
                        String hl7Message = hl7OutboundSender.buildObservationResultMessageString(dto);
                        return ResponseEntity.ok(hl7Message);
                    } catch (Exception e) {
                        log.error("Failed to serialize record {} to HL7 ORU^R01", id, e);
                        return ResponseEntity.internalServerError().body("Error encoding ORU^R01: " + e.getMessage());
                    }
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/records/{id}/send-observation")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER')")
    @Operation(
        summary = "Send HL7 ORU^R01 Observation Results to Hospital LIS",
        description = "Sends vital sign observations from an ePCR record as an HL7 v2.4 ORU^R01 message via MLLP to the destination hospital's LIS."
    )
    public ResponseEntity<Void> sendObservationMessage(@PathVariable String id) {
        log.info("Request to send HL7 ORU^R01 observation message for record ID {}", id);
        return recordService.getRecordById(id)
                .map(dto -> {
                    hl7OutboundSender.sendObservationResultMessage(dto);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  ORM^O01 — Order Entry (Medications / Procedures)
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping(value = "/records/{id}/order", produces = MediaType.TEXT_PLAIN_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER', 'VIEWER')")
    @Operation(
        summary = "Preview HL7 ORM^O01 Order Entry message",
        description = "Translates an ePCR record's medications and procedures into a raw HL7 v2.4 ORM^O01 message string for inspection (LIS integration)."
    )
    public ResponseEntity<String> previewOrderMessage(@PathVariable String id) {
        log.info("Request to preview HL7 ORM^O01 order message for record ID {}", id);
        return recordService.getRecordById(id)
                .map(dto -> {
                    try {
                        String hl7Message = hl7OutboundSender.buildOrderMessageString(dto);
                        if (hl7Message == null) {
                            return ResponseEntity.ok("No medications or procedures administered. ORM message empty.");
                        }
                        return ResponseEntity.ok(hl7Message);
                    } catch (Exception e) {
                        log.error("Failed to serialize record {} to HL7 ORM^O01", id, e);
                        return ResponseEntity.internalServerError().body("Error encoding ORM^O01: " + e.getMessage());
                    }
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/records/{id}/send-order")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER')")
    @Operation(
        summary = "Send HL7 ORM^O01 Order Entry to Hospital LIS/EHR",
        description = "Sends medications and procedures administered during transit as an HL7 v2.4 ORM^O01 message via MLLP to the hospital LIS."
    )
    public ResponseEntity<Void> sendOrderMessage(@PathVariable String id) {
        log.info("Request to send HL7 ORM^O01 order message for record ID {}", id);
        return recordService.getRecordById(id)
                .map(dto -> {
                    hl7OutboundSender.sendOrderMessage(dto);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}

