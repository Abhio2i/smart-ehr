package com.healthcare.epcr.hipaa.disclosure.controller;

import com.healthcare.epcr.hipaa.disclosure.dto.CreateDisclosureRequest;
import com.healthcare.epcr.hipaa.disclosure.model.DisclosureLog;
import com.healthcare.epcr.hipaa.disclosure.service.DisclosureService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/disclosures")
@RequiredArgsConstructor
public class DisclosureController {
    private final DisclosureService service;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<DisclosureLog> create(@Valid @RequestBody CreateDisclosureRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<List<DisclosureLog>> listByOrganization(@RequestParam String organizationId) {
        return ResponseEntity.ok(service.listByOrganization(organizationId));
    }

    @GetMapping("/patients/{patientId}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN')")
    public ResponseEntity<List<DisclosureLog>> byPatient(@PathVariable String patientId) {
        return ResponseEntity.ok(service.listByPatient(patientId));
    }

}

