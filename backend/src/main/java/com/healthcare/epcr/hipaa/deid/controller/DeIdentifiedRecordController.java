package com.healthcare.epcr.hipaa.deid.controller;

import com.healthcare.epcr.epcr.model.PatientCareRecord;
import com.healthcare.epcr.hipaa.deid.service.DeIdentificationService;
import com.healthcare.epcr.security.AccessControlService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class DeIdentifiedRecordController {
    private final DeIdentificationService service;
    private final AccessControlService accessControlService;


    @GetMapping("/hipaa/deid/record/{recordId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'PARAMEDIC', 'PHYSICIAN')")
    public ResponseEntity<PatientCareRecord> getDeidentified(@PathVariable String recordId) {
        return ResponseEntity.ok(service.getDeidentified(recordId));
    }

    // Frontend compatibility endpoints
    @PostMapping("/hipaa/deid/mask")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<PatientCareRecord>> mask(@RequestBody Map<String, String> body) {
        String organizationId = resolveOrganizationId(body);
        return ResponseEntity.ok(resolveScopedDeidentified(body, organizationId));
    }

    @PostMapping("/hipaa/deid/anonymize")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<PatientCareRecord>> anonymize(@RequestBody Map<String, String> body) {
        String organizationId = resolveOrganizationId(body);
        return ResponseEntity.ok(resolveScopedDeidentified(body, organizationId));
    }


    private String resolveOrganizationId(Map<String, String> body) {
        String organizationId = body == null ? null : body.get("organizationId");
        if (organizationId != null && !organizationId.isBlank()) {
            return organizationId;
        }
        return accessControlService.currentUser().getOrganizationId();
    }

    private List<PatientCareRecord> resolveScopedDeidentified(Map<String, String> body, String organizationId) {
        String recordId = body == null ? null : body.get("recordId");
        if (recordId != null && !recordId.isBlank()) {
            return service.listDeidentifiedByRecordId(recordId);
        }
        String patientId = body == null ? null : body.get("patientId");
        if (patientId != null && !patientId.isBlank()) {
            return service.listDeidentifiedByPatient(organizationId, patientId);
        }
        return service.listDeidentified(organizationId);
    }
}
