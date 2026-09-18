package com.healthcare.epcr.organization.controller;

import com.healthcare.epcr.organization.dto.CreateOrganizationRequest;
import com.healthcare.epcr.organization.dto.OrganizationDTO;
import com.healthcare.epcr.organization.service.IOrganizationService;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/organizations")
@RequiredArgsConstructor
public class OrganizationController {
    private final IOrganizationService organizationService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN')")
    public ResponseEntity<OrganizationDTO> createOrganization(@Valid @RequestBody CreateOrganizationRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(organizationService.createOrganization(request));
    }

    @GetMapping("/{id}")
    public ResponseEntity<OrganizationDTO> getOrganizationById(@PathVariable String id) {
        Optional<OrganizationDTO> org = organizationService.getOrganizationById(id);
        return org.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/code/{code}")
    public ResponseEntity<OrganizationDTO> getOrganizationByCode(@PathVariable String code) {
        Optional<OrganizationDTO> org = organizationService.getOrganizationByCode(code);
        return org.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping
    public ResponseEntity<Page<OrganizationDTO>> getAllOrganizations(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "DESC") Sort.Direction direction) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortBy));
        return ResponseEntity.ok(organizationService.getAllOrganizations(pageable));
    }

    @GetMapping("/active")
    public ResponseEntity<Page<OrganizationDTO>> getActiveOrganizations(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size);
        return ResponseEntity.ok(organizationService.getActiveOrganizations(pageable));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN')")
    public ResponseEntity<OrganizationDTO> updateOrganization(@PathVariable String id,
                                                          @Valid @RequestBody CreateOrganizationRequest request) {
        return ResponseEntity.ok(organizationService.updateOrganization(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteOrganization(@PathVariable String id) {
        organizationService.deleteOrganization(id);
        return ResponseEntity.noContent().build();
    }
}


