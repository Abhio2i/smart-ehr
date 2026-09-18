package com.healthcare.epcr.formengine.controller;

import com.healthcare.epcr.formengine.model.FormSubmission;
import com.healthcare.epcr.formengine.model.FormTemplate;
import com.healthcare.epcr.formengine.service.FormEngineService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/formengine")
@RequiredArgsConstructor
public class FormEngineController {

    private final FormEngineService formEngineService;

    @PostMapping("/templates")
    @PreAuthorize("@accessControlService.canAccessOrganization(#template.organizationId)")
    public ResponseEntity<FormTemplate> createTemplate(@RequestBody FormTemplate template) {
        return ResponseEntity.status(HttpStatus.CREATED).body(formEngineService.createTemplate(template));
    }

    @GetMapping("/templates")
    @PreAuthorize("@accessControlService.canAccessOrganization(#organizationId)")
    public ResponseEntity<List<FormTemplate>> getTemplatesByOrgAndType(
            @RequestParam String organizationId,
            @RequestParam String templateType) {
        return ResponseEntity.ok(formEngineService.getTemplatesByOrgAndType(organizationId, templateType));
    }

    @GetMapping("/templates/latest")
    @PreAuthorize("@accessControlService.canAccessOrganization(#organizationId)")
    public ResponseEntity<FormTemplate> getLatestTemplate(
            @RequestParam String organizationId,
            @RequestParam String templateType) {
        return ResponseEntity.ok(formEngineService.getLatestPublishedTemplate(organizationId, templateType));
    }

    @PostMapping("/templates/{templateId}/submissions")
    public ResponseEntity<FormSubmission> submitTemplate(
            @PathVariable String templateId,
            @RequestBody FormSubmission submission) {
        // Authorization is handled within the service layer after fetching the template
        return ResponseEntity.status(HttpStatus.CREATED).body(formEngineService.submitAgainstTemplate(templateId, submission));
    }

    @GetMapping("/submissions")
    @PreAuthorize("@accessControlService.canAccessOrganization(#organizationId)")
    public ResponseEntity<List<FormSubmission>> getSubmissions(@RequestParam String organizationId) {
        return ResponseEntity.ok(formEngineService.getSubmissionsByOrganization(organizationId));
    }
}
