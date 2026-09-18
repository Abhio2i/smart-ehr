package com.healthcare.epcr.workflow.controller;

import com.healthcare.epcr.workflow.model.ConfigDeployment;
import com.healthcare.epcr.workflow.service.ConfigDeploymentService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/workflows/deployments")
@RequiredArgsConstructor
public class ConfigDeploymentController {

    private final ConfigDeploymentService configDeploymentService;

    @PostMapping
    public ResponseEntity<ConfigDeployment> deploy(@RequestBody ConfigDeployment deployment, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(configDeploymentService.deploy(deployment, request));
    }

    @GetMapping
    public ResponseEntity<List<ConfigDeployment>> list() {
        return ResponseEntity.ok(configDeploymentService.list());
    }
}
