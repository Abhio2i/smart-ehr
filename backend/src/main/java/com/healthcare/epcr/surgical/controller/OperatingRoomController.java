package com.healthcare.epcr.surgical.controller;

import com.healthcare.epcr.security.AccessControlService;
import com.healthcare.epcr.surgical.model.OperatingRoom;
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
 * OperatingRoomController — CRUD for physical OR rooms.
 *
 * Base URL: /api/surgical/operating-rooms
 *
 * Endpoints:
 *   POST   /                  — Register a new OR
 *   GET    /                  — List all ORs (org-scoped)
 *   PUT    /{id}              — Update OR details
 *   DELETE /{id}              — Deactivate/delete OR
 */
@RestController
@RequestMapping("/api/surgical/operating-rooms")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Surgical — Operating Rooms", description = "Physical OR room management")
public class OperatingRoomController {

    private final SurgicalCareService surgicalCareService;
    private final AccessControlService accessControlService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    @Operation(summary = "Register a new Operating Room")
    public ResponseEntity<OperatingRoom> createOR(@RequestBody OperatingRoom room) {
        User currentUser = accessControlService.currentUser();
        OperatingRoom saved = surgicalCareService.createOR(
                room, currentUser.getOrganizationId(), currentUser.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN','PARAMEDIC')")
    @Operation(summary = "List all Operating Rooms for the organization")
    public ResponseEntity<List<OperatingRoom>> getORs() {
        User currentUser = accessControlService.currentUser();
        return ResponseEntity.ok(surgicalCareService.getORs(currentUser.getOrganizationId()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    @Operation(summary = "Update Operating Room details or equipment tags")
    public ResponseEntity<OperatingRoom> updateOR(
            @PathVariable String id,
            @RequestBody OperatingRoom update) {
        User currentUser = accessControlService.currentUser();
        return ResponseEntity.ok(
                surgicalCareService.updateOR(id, update, currentUser.getOrganizationId()));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    @Operation(summary = "Delete / deactivate an Operating Room")
    public ResponseEntity<Map<String, String>> deleteOR(@PathVariable String id) {
        User currentUser = accessControlService.currentUser();
        surgicalCareService.deleteOR(id, currentUser.getOrganizationId());
        return ResponseEntity.ok(Map.of("message", "Operating Room deleted successfully."));
    }
}
