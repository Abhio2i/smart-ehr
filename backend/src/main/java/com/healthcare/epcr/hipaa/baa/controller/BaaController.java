package com.healthcare.epcr.hipaa.baa.controller;

import com.healthcare.epcr.hipaa.baa.model.BusinessAssociate;
import com.healthcare.epcr.hipaa.baa.service.BaaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/baas/vendors")
@RequiredArgsConstructor
public class BaaController {
    private final BaaService service;

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<BusinessAssociate> create(@RequestBody Map<String, String> body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(body));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<List<BusinessAssociate>> list(@RequestParam String organizationId) {
        return ResponseEntity.ok(service.list(organizationId));
    }

    @GetMapping("/{vendorId}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<BusinessAssociate> get(@PathVariable String vendorId) {
        return ResponseEntity.ok(service.get(vendorId));
    }

    @PostMapping("/{vendorId}/activate")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<BusinessAssociate> activate(@PathVariable String vendorId) {
        return ResponseEntity.ok(service.updateStatus(vendorId, "ACTIVE"));
    }

    @PostMapping("/{vendorId}/suspend")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<BusinessAssociate> suspend(@PathVariable String vendorId) {
        return ResponseEntity.ok(service.updateStatus(vendorId, "SUSPENDED"));
    }
}

