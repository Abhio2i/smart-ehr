package com.healthcare.epcr.workflow.controller;

import com.healthcare.epcr.workflow.model.Workflow;
import com.healthcare.epcr.workflow.service.WorkflowService;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/workflows")
@RequiredArgsConstructor
public class WorkflowController {
    private final WorkflowService workflowService;

    @PostMapping
    public ResponseEntity<Workflow> createWorkflow(@RequestBody Workflow workflow) {
        return ResponseEntity.status(HttpStatus.CREATED).body(workflowService.createWorkflow(workflow));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Workflow> getWorkflowById(@PathVariable String id) {
        Optional<Workflow> workflow = workflowService.getWorkflowById(id);
        return workflow.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping
    public ResponseEntity<List<Workflow>> getAllWorkflows() {
        return ResponseEntity.ok(workflowService.getAllWorkflows());
    }

    @GetMapping("/organization/{organizationId}")
    public ResponseEntity<List<Workflow>> getWorkflowsByOrganization(@PathVariable String organizationId) {
        return ResponseEntity.ok(workflowService.getWorkflowsByOrganization(organizationId));
    }

    @GetMapping("/active")
    public ResponseEntity<List<Workflow>> getActiveWorkflows() {
        return ResponseEntity.ok(workflowService.getActiveWorkflows());
    }

    @PutMapping("/{id}")
    public ResponseEntity<Workflow> updateWorkflow(@PathVariable String id, @RequestBody Workflow workflow) {
        return ResponseEntity.ok(workflowService.updateWorkflow(id, workflow));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteWorkflow(@PathVariable String id) {
        workflowService.deleteWorkflow(id);
        return ResponseEntity.noContent().build();
    }
}


