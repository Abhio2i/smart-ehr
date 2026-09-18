package com.healthcare.epcr.rulesengine.controller;


import com.healthcare.epcr.rulesengine.dto.RunRulesRequest;
import com.healthcare.epcr.rulesengine.dto.RunRulesResponse;
import com.healthcare.epcr.rulesengine.model.IfThenAction;
import com.healthcare.epcr.rulesengine.model.IfThenRule;
import com.healthcare.epcr.rulesengine.service.IfThenLogicService;
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
import java.util.Set;

@RestController
@RequestMapping("/api/logic")
@RequiredArgsConstructor
public class IfThenLogicController {
    private final IfThenLogicService logicService;

    /**
     * Create a generic rule (Admin, Manager, Physician can create)
     * Admin can create for any organization
     * Others create for their own organization
     */
    @PostMapping("/rules")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN')")
    public ResponseEntity<IfThenRule> createRule(@RequestBody IfThenRule rule) {
        return ResponseEntity.status(HttpStatus.CREATED).body(logicService.createRule(rule));
    }

    /**
     * List rules for an organization
     * Admin can see all organizations
     * Others see only their own organization
     */
    @GetMapping("/rules")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER')")
    public ResponseEntity<List<IfThenRule>> listRules(@RequestParam(required = false) String organizationId) {
        return ResponseEntity.ok(logicService.listRules(organizationId));
    }

    /**
     * List standard first-class fields available for rule conditions.
     * Custom fields can also be targeted with clinicalData.{key} or dynamicFormResponses.{key}.
     */
    @GetMapping("/rules/fields")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER')")
    public ResponseEntity<Set<String>> supportedFields() {
        return ResponseEntity.ok(logicService.supportedFields());
    }

    /**
     * Create a Full Body Checkup rule (simplified endpoint)
     * Admin, Manager, Physician can create
     * Paramedic can also create for screening campaigns
     */

    /**
     * Run rules on all patients for an organization
     * Admin can run for any organization
     * Others run for their own organization only
     *
     * @param request dryRun=true to test without sending emails
     */
    @PostMapping("/run")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC')")
    public ResponseEntity<RunRulesResponse> runRules(@RequestBody(required = false) RunRulesRequest request) {
        RunRulesRequest safeRequest = request == null ? new RunRulesRequest() : request;
        return ResponseEntity.ok(logicService.runForAccessibleRecords(
                safeRequest.getOrganizationId(),
                !Boolean.FALSE.equals(safeRequest.getDryRun()),
                safeRequest.getRuleIds(),
                safeRequest.getPatientIds(),
                safeRequest.getRecordIds()
        ));
    }

    /**
     * Run rules for a specific patient
     * Admin can run for any patient across organizations
     * Others can run for patients in their organization only
     *
     * @param patientId The patient to run rules for
     * @param request dryRun=true to test without sending emails
     */
    @PostMapping("/run/patient/{patientId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC')")
    public ResponseEntity<RunRulesResponse> runRulesForPatient(
            @PathVariable String patientId,
            @RequestBody(required = false) RunRulesRequest request) {
        RunRulesRequest safeRequest = request == null ? new RunRulesRequest() : request;
        return ResponseEntity.ok(logicService.runForPatient(patientId, !Boolean.FALSE.equals(safeRequest.getDryRun())));
    }
}
