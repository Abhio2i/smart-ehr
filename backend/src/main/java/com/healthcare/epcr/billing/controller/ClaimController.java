package com.healthcare.epcr.billing.controller;

import com.healthcare.epcr.billing.dto.CreateClaimRequest;
import com.healthcare.epcr.billing.model.Claim;
import com.healthcare.epcr.billing.model.ClaimStatus;
import com.healthcare.epcr.billing.service.ClaimService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/billing/claims")
@RequiredArgsConstructor
public class ClaimController {

    private final ClaimService claimService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN','PARAMEDIC')")
    public ResponseEntity<Claim> createClaim(
            @RequestBody CreateClaimRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        return ResponseEntity.ok(claimService.createClaim(request, idempotencyKey));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN','PARAMEDIC','QA_REVIEWER','PATIENT')")
    public ResponseEntity<Claim> getClaim(@PathVariable String id) {
        return ResponseEntity.ok(claimService.getClaim(id));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN','QA_REVIEWER','PARAMEDIC','VIEWER')")
    public ResponseEntity<Page<Claim>> listClaims(
            @RequestParam(required = false) ClaimStatus status,
            @RequestParam(required = false) String organizationId,
            Pageable pageable) {
        return ResponseEntity.ok(claimService.listClaims(status, organizationId, pageable));
    }

    @PostMapping("/{id}/submit")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN')")
    public ResponseEntity<Claim> submitClaim(@PathVariable String id) {
        return ResponseEntity.ok(claimService.submit(id));
    }

    @PostMapping("/{id}/deny")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<Claim> denyClaim(
            @PathVariable String id,
            @RequestBody DenyClaimRequest request) {
        return ResponseEntity.ok(claimService.deny(id, request.getDenialCode(), request.getDenialReason()));
    }

    @PostMapping("/{id}/appeal")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN')")
    public ResponseEntity<Claim> appealClaim(@PathVariable String id) {
        return ResponseEntity.ok(claimService.appeal(id));
    }

    @DeleteMapping("/void/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','USER','PHYSICIAN')")
    public ResponseEntity<Claim> voidClaim(@PathVariable String id) {
        return ResponseEntity.ok(claimService.voidClaim(id));
    }

    // simple inner DTO for deny request body
    public static class DenyClaimRequest {
        private String denialCode;
        private String denialReason;
        public String getDenialCode() { return denialCode; }
        public void setDenialCode(String denialCode) { this.denialCode = denialCode; }
        public String getDenialReason() { return denialReason; }
        public void setDenialReason(String denialReason) { this.denialReason = denialReason; }
    }
}
