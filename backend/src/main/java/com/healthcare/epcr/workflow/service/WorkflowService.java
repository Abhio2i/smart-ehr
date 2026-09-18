package com.healthcare.epcr.workflow.service;

import com.healthcare.epcr.common.exception.ResourceNotFoundException;
import com.healthcare.epcr.organization.repository.OrganizationRepository;
import com.healthcare.epcr.security.AccessControlService;
import com.healthcare.epcr.workflow.model.Workflow;
import com.healthcare.epcr.workflow.repository.WorkflowRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class WorkflowService {

    private final WorkflowRepository workflowRepository;
    private final OrganizationRepository organizationRepository;
    private final AccessControlService accessControlService;

    public Workflow createWorkflow(Workflow workflow) {
        if (workflow.getOrganizationId() == null || workflow.getOrganizationId().isBlank()) {
            throw new IllegalArgumentException("organizationId is required");
        }
        if (!organizationRepository.existsById(workflow.getOrganizationId())) {
            throw new IllegalArgumentException("Organization not found with id: " + workflow.getOrganizationId());
        }
        accessControlService.assertOrganizationAccess(workflow.getOrganizationId());

        workflow.setCreatedAt(LocalDateTime.now());
        workflow.setUpdatedAt(LocalDateTime.now());
        if (workflow.getActive() == null) {
            workflow.setActive(true);
        }
        return workflowRepository.save(workflow);
    }

    public Optional<Workflow> getWorkflowById(String id) {
        return workflowRepository.findById(id)
                .filter(wf -> accessControlService.canAccessOrganization(wf.getOrganizationId()));
    }

    public List<Workflow> getAllWorkflows() {
        return workflowRepository.findAll().stream()
                .filter(wf -> accessControlService.canAccessOrganization(wf.getOrganizationId()))
                .toList();
    }

    public List<Workflow> getWorkflowsByOrganization(String organizationId) {
        accessControlService.assertOrganizationAccess(organizationId);
        return workflowRepository.findByOrganizationId(organizationId);
    }

    public List<Workflow> getActiveWorkflows() {
        return workflowRepository.findByActive(true).stream()
                .filter(wf -> accessControlService.canAccessOrganization(wf.getOrganizationId()))
                .toList();
    }

    public Workflow updateWorkflow(String id, Workflow workflow) {
        Workflow existing = workflowRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Workflow not found with id: " + id));

        if (workflow.getOrganizationId() == null || workflow.getOrganizationId().isBlank()) {
            throw new IllegalArgumentException("organizationId is required");
        }
        if (!organizationRepository.existsById(workflow.getOrganizationId())) {
            throw new IllegalArgumentException("Organization not found with id: " + workflow.getOrganizationId());
        }
        accessControlService.assertOrganizationAccess(existing.getOrganizationId());

        workflow.setId(existing.getId());
        workflow.setCreatedAt(existing.getCreatedAt());
        workflow.setUpdatedAt(LocalDateTime.now());
        return workflowRepository.save(workflow);
    }

    public void deleteWorkflow(String id) {
        if (!workflowRepository.existsById(id)) {
            throw new ResourceNotFoundException("Workflow not found with id: " + id);
        }
        Workflow existing = workflowRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Workflow not found with id: " + id));
        accessControlService.assertOrganizationAccess(existing.getOrganizationId());
        workflowRepository.deleteById(id);
    }
}
