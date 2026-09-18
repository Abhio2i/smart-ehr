package com.healthcare.epcr.surgical.controller;

import com.healthcare.epcr.security.AccessControlService;
import com.healthcare.epcr.surgical.model.ORBlockSchedule;
import com.healthcare.epcr.surgical.service.SurgicalCareService;
import com.healthcare.epcr.user.model.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * ORBlockController — manage recurring OR block schedules for surgeons.
 *
 * Base URL: /api/surgical/or-blocks
 *
 * Endpoints:
 *   POST   /                  — Create a block schedule
 *   GET    /                  — List blocks (?orId= | ?surgeonId=)
 *   DELETE /{id}              — Remove a block schedule
 */
@RestController
@RequestMapping("/api/surgical/or-blocks")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Surgical — OR Block Schedules", description = "Recurring OR block reservation management")
public class ORBlockController {

    private final SurgicalCareService surgicalCareService;
    private final AccessControlService accessControlService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN')")
    @Operation(summary = "Create a recurring OR block schedule for a surgeon")
    public ResponseEntity<ORBlockSchedule> createBlock(@RequestBody ORBlockSchedule block) {
        User currentUser = accessControlService.currentUser();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(surgicalCareService.createBlock(block, currentUser.getOrganizationId()));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN','PARAMEDIC')")
    @Operation(summary = "List OR block schedules (optionally filtered by orId or surgeonId)")
    public ResponseEntity<List<ORBlockSchedule>> getBlocks(
            @RequestParam(required = false) String orId,
            @RequestParam(required = false) String surgeonId) {
        User currentUser = accessControlService.currentUser();
        return ResponseEntity.ok(
                surgicalCareService.getBlocks(currentUser.getOrganizationId(), orId, surgeonId));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    @Operation(summary = "Remove a recurring OR block schedule")
    public ResponseEntity<Map<String, String>> deleteBlock(@PathVariable String id) {
        User currentUser = accessControlService.currentUser();
        surgicalCareService.deleteBlock(id, currentUser.getOrganizationId());
        return ResponseEntity.ok(Map.of("message", "Block schedule removed successfully."));
    }
}
