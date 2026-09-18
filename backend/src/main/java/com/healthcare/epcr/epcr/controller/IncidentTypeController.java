package com.healthcare.epcr.epcr.controller;

import com.healthcare.epcr.epcr.service.IPatientCareRecordService;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/epcr")
@RequiredArgsConstructor
public class IncidentTypeController {
    private final IPatientCareRecordService recordService;

    @GetMapping("/incident-types")
    @Operation(summary = "Get supported ePCR incident types")
    public ResponseEntity<List<String>> getIncidentTypes() {
        return ResponseEntity.ok(recordService.getIncidentTypes());
    }
}
