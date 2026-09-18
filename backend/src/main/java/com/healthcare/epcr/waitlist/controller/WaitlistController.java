package com.healthcare.epcr.waitlist.controller;

import com.healthcare.epcr.security.AccessControlService;
import com.healthcare.epcr.user.model.Role;
import com.healthcare.epcr.user.model.User;
import com.healthcare.epcr.waitlist.dto.*;
import com.healthcare.epcr.waitlist.enums.WaitlistPriority;
import com.healthcare.epcr.waitlist.service.WaitlistService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * REST controller for the Waitlist Management module.
 *
 * RBAC:
 *   ADMIN, PHYSICIAN, PARAMEDIC → add, update priority, delete entries
 *   ADMIN, PHYSICIAN, PARAMEDIC, MANAGER → read queue and stats
 *   PATIENT → read-only view of their own entry; accept/decline their own offer
 */
@RestController
@RequestMapping("/api/waitlist")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Waitlist Management", description = "Patient access queue management APIs — RFP Manage Patient Access domain")
public class WaitlistController {

    private final WaitlistService waitlistService;
    private final AccessControlService accessControlService;

    // ── POST /api/waitlist/entries ───────────────────────────────────────────

    @PostMapping("/entries")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHYSICIAN', 'PARAMEDIC', 'MANAGER')")
    @Operation(
        summary = "Add patient to waitlist",
        description = "Adds a patient to the service waitlist. Idempotency-Key header prevents duplicate submissions."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Entry created"),
        @ApiResponse(responseCode = "400", description = "Invalid request payload"),
        @ApiResponse(responseCode = "401", description = "Unauthorized"),
        @ApiResponse(responseCode = "403", description = "Forbidden")
    })
    public ResponseEntity<WaitlistEntryDTO> addToWaitlist(
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody AddToWaitlistRequest request) {
        WaitlistEntryDTO created = waitlistService.addToWaitlist(request, idempotencyKey);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    // ── GET /api/waitlist/entries/{id} ───────────────────────────────────────

    @GetMapping("/entries/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHYSICIAN', 'PARAMEDIC', 'MANAGER', 'QA_REVIEWER', 'PATIENT')")
    @Operation(summary = "Get a waitlist entry by ID",
               description = "PATIENT role can only view their own entry.")
    public ResponseEntity<WaitlistEntryDTO> getEntryById(
            @Parameter(description = "Waitlist entry ID") @PathVariable String id) {
        User currentUser = accessControlService.currentUser();
        WaitlistEntryDTO dto = waitlistService.getEntryById(id, currentUser.getOrganizationId());
        return ResponseEntity.ok(dto);
    }

    @GetMapping("/my-entries")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHYSICIAN', 'PARAMEDIC', 'MANAGER', 'PATIENT')")
    @Operation(summary = "Get current user's waitlist entries",
               description = "Patients can view all their waitlist entries.")
    public ResponseEntity<java.util.List<WaitlistEntryDTO>> getMyEntries() {
        User currentUser = accessControlService.currentUser();
        java.util.List<WaitlistEntryDTO> list = waitlistService.getEntriesByPatientId(
                currentUser.getRole() == com.healthcare.epcr.user.model.Role.PATIENT ? currentUser.getId() : null,
                currentUser.getOrganizationId());
        return ResponseEntity.ok(list);
    }

    // ── GET /api/waitlist/queue ───────────────────────────────────────────────

    @GetMapping("/queue")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHYSICIAN', 'PARAMEDIC', 'MANAGER', 'QA_REVIEWER')")
    @Operation(
        summary = "Get the waiting queue for a facility and service type",
        description = "Returns WAITING entries sorted by priority (DESC) then createdAt (ASC). " +
                      "Position is computed dynamically — no stored position field. " +
                      "Results are Redis-cached for 45 seconds and invalidated on any write."
    )
    public ResponseEntity<WaitlistQueueResponse> getQueue(
            @Parameter(description = "Facility ID to scope the queue") @RequestParam String facilityId,
            @Parameter(description = "Service type (e.g. CARDIOLOGY, DENTAL)") @RequestParam String serviceType) {
        User currentUser = accessControlService.currentUser();
        WaitlistQueueResponse response = waitlistService.getQueue(
                currentUser.getOrganizationId(), facilityId, serviceType);
        return ResponseEntity.ok(response);
    }

    // ── PUT /api/waitlist/entries/{id}/priority ───────────────────────────────

    @PutMapping("/entries/{id}/priority")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHYSICIAN', 'PARAMEDIC')")
    @Operation(summary = "Update the priority of a WAITING entry",
               description = "Optimistic locking via @Version ensures no concurrent priority conflicts.")
    public ResponseEntity<WaitlistEntryDTO> updatePriority(
            @PathVariable String id,
            @Valid @RequestBody UpdatePriorityRequest request) {
        User currentUser = accessControlService.currentUser();
        WaitlistEntryDTO dto = waitlistService.updatePriority(id, request.getPriority(), currentUser.getOrganizationId());
        return ResponseEntity.ok(dto);
    }

    // ── POST /api/waitlist/entries/{id}/accept-offer ──────────────────────────

    @PostMapping("/entries/{id}/accept-offer")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHYSICIAN', 'PARAMEDIC', 'MANAGER', 'PATIENT')")
    @Operation(
        summary = "Accept a slot offer",
        description = "Books the offered AppointmentSlot atomically and transitions the entry to SCHEDULED. " +
                      "If the slot was taken concurrently, the patient is re-queued automatically."
    )
    public ResponseEntity<WaitlistEntryDTO> acceptOffer(@PathVariable String id) {
        User currentUser = accessControlService.currentUser();
        WaitlistEntryDTO dto = waitlistService.acceptOffer(id, currentUser.getOrganizationId());
        return ResponseEntity.ok(dto);
    }

    // ── POST /api/waitlist/entries/{id}/decline-offer ─────────────────────────

    @PostMapping("/entries/{id}/decline-offer")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHYSICIAN', 'PARAMEDIC', 'MANAGER', 'PATIENT')")
    @Operation(
        summary = "Decline a slot offer",
        description = "Frees the offered slot back to OPEN and transitions the entry to DECLINED. " +
                      "The next patient in queue is offered the slot immediately."
    )
    public ResponseEntity<WaitlistEntryDTO> declineOffer(@PathVariable String id) {
        User currentUser = accessControlService.currentUser();
        WaitlistEntryDTO dto = waitlistService.declineOffer(id, currentUser.getOrganizationId());
        return ResponseEntity.ok(dto);
    }

    // ── DELETE /api/waitlist/entries/{id} ─────────────────────────────────────

    @DeleteMapping("/entries/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHYSICIAN', 'PARAMEDIC')")
    @Operation(
        summary = "Remove a waitlist entry",
        description = "Sets entry status to REMOVED. If the entry is OFFERED, the slot is freed and offered to the next patient."
    )
    public ResponseEntity<Map<String, String>> removeEntry(@PathVariable String id) {
        User currentUser = accessControlService.currentUser();
        waitlistService.removeEntry(id, currentUser.getOrganizationId());
        return ResponseEntity.ok(Map.of("message", "Waitlist entry removed successfully.", "id", id));
    }

    // ── GET /api/waitlist/stats ────────────────────────────────────────────────

    @GetMapping("/stats")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHYSICIAN', 'MANAGER')")
    @Operation(
        summary = "Get waitlist statistics for an organization",
        description = "Returns aggregate counts by status across all facilities and service types."
    )
    public ResponseEntity<WaitlistStatsDTO> getStats(
            @Parameter(description = "Organization ID (ADMIN can specify; others see their own org)")
            @RequestParam(required = false) String organizationId) {
        User currentUser = accessControlService.currentUser();
        String resolvedOrgId = (currentUser.getRole() == Role.ADMIN && organizationId != null)
                ? organizationId
                : currentUser.getOrganizationId();
        WaitlistStatsDTO stats = waitlistService.getStats(resolvedOrgId);
        return ResponseEntity.ok(stats);
    }

    // ── Inner Request DTO ──────────────────────────────────────────────────────

    @Data
    public static class UpdatePriorityRequest {
        private WaitlistPriority priority;
    }
}
