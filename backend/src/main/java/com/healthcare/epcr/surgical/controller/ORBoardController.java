package com.healthcare.epcr.surgical.controller;

import com.healthcare.epcr.security.AccessControlService;
import com.healthcare.epcr.surgical.model.SurgicalCase;
import com.healthcare.epcr.surgical.service.SurgicalCareService;
import com.healthcare.epcr.user.model.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * ORBoardController — OR dispatch board for a specific date.
 * Mirrors HomeCareController.getDispatchBoard() pattern.
 *
 * Base URL: /api/surgical/dispatch-board
 *
 * Endpoints:
 *   GET /api/surgical/dispatch-board?date=2026-07-14&facilityId=...
 *   Returns all cases for the date, sorted by scheduledStart, across all ORs.
 */
@RestController
@RequestMapping("/api/surgical/dispatch-board")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Surgical — OR Board", description = "Operating room day view — all cases for a date")
public class ORBoardController {

    private final SurgicalCareService surgicalCareService;
    private final AccessControlService accessControlService;

    /**
     * GET /api/surgical/dispatch-board?date=2026-07-14&facilityId=FAC-001
     * Returns all surgical cases scheduled for the given date,
     * sorted by scheduledStart. Optionally filtered by facilityId.
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN','PARAMEDIC')")
    @Operation(
        summary = "OR Board for a date",
        description = "Returns all surgical cases for the given date sorted by scheduledStart. " +
                      "Optionally filter by facilityId. Use this to power the OR board UI."
    )
    public ResponseEntity<List<SurgicalCase>> getORBoard(
            @RequestParam String date,
            @RequestParam(required = false) String facilityId) {
        User currentUser = accessControlService.currentUser();
        List<SurgicalCase> board = surgicalCareService.getORBoard(
                currentUser.getOrganizationId(), date, facilityId);
        return ResponseEntity.ok(board);
    }
}
