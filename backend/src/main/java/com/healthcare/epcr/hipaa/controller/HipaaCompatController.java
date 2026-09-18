package com.healthcare.epcr.hipaa.controller;

import com.healthcare.epcr.hipaa.baa.model.BusinessAssociate;
import com.healthcare.epcr.hipaa.baa.repository.BusinessAssociateRepository;
import com.healthcare.epcr.hipaa.baa.service.BaaService;
import com.healthcare.epcr.hipaa.consent.model.PatientConsent;
import com.healthcare.epcr.hipaa.consent.repository.PatientConsentRepository;
import com.healthcare.epcr.hipaa.consent.service.PatientConsentService;
import com.healthcare.epcr.hipaa.disclosure.model.DisclosureLog;
import com.healthcare.epcr.hipaa.disclosure.repository.DisclosureLogRepository;
import com.healthcare.epcr.hipaa.disclosure.service.DisclosureService;
import com.healthcare.epcr.security.AccessControlService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collections;
import java.util.List;

@RestController
@RequestMapping("/api/hipaa")
@RequiredArgsConstructor
@Tag(name = "HIPAA Compatibility", description = "Compatibility endpoints used by the frontend for HIPAA consent, disclosure, and BAA views")
public class HipaaCompatController {
    private final PatientConsentService consentService;
    private final DisclosureService disclosureService;
    private final BaaService baaService;
    private final AccessControlService accessControlService;
    private final PatientConsentRepository patientConsentRepository;
    private final DisclosureLogRepository disclosureLogRepository;
    private final BusinessAssociateRepository businessAssociateRepository;

    @GetMapping("/consent")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN','VIEWER')")
    @Operation(summary = "List HIPAA consent records", description = "Returns consent records by patientId when provided, otherwise for the current user's organization.")
    public ResponseEntity<List<PatientConsent>> consent(
            @Parameter(description = "Optional patient identifier") @RequestParam(required = false) String patientId,
            @Parameter(description = "Page number (0-based)") @RequestParam(required = false) Integer page,
            @Parameter(description = "Page size") @RequestParam(required = false) Integer size) {
        List<PatientConsent> result;
        if (patientId != null && !patientId.isBlank()) {
            result = consentService.listByPatient(patientId);
        } else {
            String organizationId = accessControlService.currentUser().getOrganizationId();
            result = consentService.listByOrganization(organizationId);
        }
        List<PatientConsent> paged = paginate(result, page, size);
        return ResponseEntity.ok()
                .header("X-Total-Count", String.valueOf(result.size()))
                .body(paged);
    }

    @GetMapping("/consent/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN','VIEWER')")
    @Operation(summary = "Get HIPAA consent by ID")
    public ResponseEntity<PatientConsent> consentById(
            @Parameter(description = "Consent record ID", required = true) @PathVariable String id) {
        PatientConsent consent = patientConsentRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Consent not found"));
        accessControlService.assertOrganizationAccess(consent.getOrganizationId());
        return ResponseEntity.ok(consent);
    }

    @GetMapping("/disclosure")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN','VIEWER')")
    @Operation(summary = "List HIPAA disclosure logs", description = "Returns disclosure logs by organizationId. If organizationId is omitted, uses current user's organization.")
    public ResponseEntity<List<DisclosureLog>> disclosure(
            @Parameter(description = "Optional organization identifier") @RequestParam(required = false) String organizationId,
            @Parameter(description = "Page number (0-based)") @RequestParam(required = false) Integer page,
            @Parameter(description = "Page size") @RequestParam(required = false) Integer size) {
        String orgId = (organizationId == null || organizationId.isBlank())
                ? accessControlService.currentUser().getOrganizationId()
                : organizationId;
        List<DisclosureLog> result = disclosureService.listByOrganization(orgId);
        List<DisclosureLog> paged = paginate(result, page, size);
        return ResponseEntity.ok()
                .header("X-Total-Count", String.valueOf(result.size()))
                .body(paged);
    }

    @GetMapping("/disclosure/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN','VIEWER')")
    @Operation(summary = "Get HIPAA disclosure log by ID")
    public ResponseEntity<DisclosureLog> disclosureById(
            @Parameter(description = "Disclosure log ID", required = true) @PathVariable String id) {
        DisclosureLog disclosure = disclosureLogRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Disclosure not found"));
        accessControlService.assertOrganizationAccess(disclosure.getOrganizationId());
        return ResponseEntity.ok(disclosure);
    }

    @GetMapping("/baa/organization/{organizationId}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    @Operation(summary = "List Business Associates by organization")
    public ResponseEntity<List<BusinessAssociate>> baaByOrganization(
            @Parameter(description = "Organization ID", required = true) @PathVariable String organizationId,
            @Parameter(description = "Page number (0-based)") @RequestParam(required = false) Integer page,
            @Parameter(description = "Page size") @RequestParam(required = false) Integer size) {
        List<BusinessAssociate> result = baaService.list(organizationId);
        List<BusinessAssociate> paged = paginate(result, page, size);
        return ResponseEntity.ok()
                .header("X-Total-Count", String.valueOf(result.size()))
                .body(paged);
    }

    @GetMapping("/baa/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    @Operation(summary = "Get Business Associate by ID")
    public ResponseEntity<BusinessAssociate> baaById(
            @Parameter(description = "Business Associate ID", required = true) @PathVariable String id) {
        BusinessAssociate baa = businessAssociateRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Business associate not found"));
        accessControlService.assertOrganizationAccess(baa.getOrganizationId());
        return ResponseEntity.ok(baa);
    }

    private <T> List<T> paginate(List<T> items, Integer page, Integer size) {
        if (items == null || items.isEmpty()) {
            return Collections.emptyList();
        }
        if (page == null || size == null || page < 0 || size <= 0) {
            return items;
        }
        int from = page * size;
        if (from >= items.size()) {
            return Collections.emptyList();
        }
        int to = Math.min(from + size, items.size());
        return items.subList(from, to);
    }
}
