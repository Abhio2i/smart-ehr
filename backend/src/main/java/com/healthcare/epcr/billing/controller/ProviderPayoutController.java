package com.healthcare.epcr.billing.controller;

import com.healthcare.epcr.billing.model.ProviderPayout;
import com.healthcare.epcr.billing.model.ProviderPaymentRate;
import com.healthcare.epcr.billing.model.ProviderShiftLog;
import com.healthcare.epcr.billing.service.ProviderPayoutService;
import com.healthcare.epcr.billing.repository.ProviderShiftLogRepository;
import com.healthcare.epcr.user.model.User;
import com.healthcare.epcr.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/billing/payouts")
@RequiredArgsConstructor
public class ProviderPayoutController {

    private final ProviderPayoutService payoutService;
    private final ProviderShiftLogRepository shiftLogRepository;
    private final UserRepository userRepository;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalStateException("Current user not found for email: " + email));
    }

    // ── RATES ENDPOINTS ──────────────────────────────────────

    @PostMapping("/rates")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<ProviderPaymentRate> createRate(@RequestBody ProviderPaymentRate rate) {
        User currentUser = getCurrentUser();
        rate.setOrganizationId(currentUser.getOrganizationId());
        return ResponseEntity.ok(payoutService.createRate(rate));
    }

    @GetMapping("/rates")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<List<ProviderPaymentRate>> getRates(@RequestParam String organizationId) {
        User currentUser = getCurrentUser();
        if (!"ADMIN".equals(currentUser.getRole().name()) && !currentUser.getOrganizationId().equals(organizationId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(payoutService.getRatesByOrg(organizationId));
    }

    @GetMapping("/rates/provider/{providerId}")
    public ResponseEntity<ProviderPaymentRate> getActiveRate(@PathVariable String providerId) {
        User currentUser = getCurrentUser();
        if (!"ADMIN".equals(currentUser.getRole().name()) && !"MANAGER".equals(currentUser.getRole().name()) && !currentUser.getId().equals(providerId)) {
            return ResponseEntity.status(403).build();
        }
        ProviderPaymentRate rate = payoutService.getActiveRateForProvider(providerId).orElse(null);
        // Tenant lock: check that requested rate matches currentUser organization
        if (rate != null && !rate.getOrganizationId().equals(currentUser.getOrganizationId())) {
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(rate);
    }

    // ── SHIFTS ENDPOINTS (for auditing logs) ─────────────────

    @GetMapping("/shifts")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<List<ProviderShiftLog>> listShifts(@RequestParam String organizationId) {
        User currentUser = getCurrentUser();
        if (!"ADMIN".equals(currentUser.getRole().name()) && !currentUser.getOrganizationId().equals(organizationId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(shiftLogRepository.findByOrganizationId(organizationId));
    }

    @GetMapping("/shifts/provider/{providerId}")
    public ResponseEntity<List<ProviderShiftLog>> listShiftsForProvider(@PathVariable String providerId) {
        User currentUser = getCurrentUser();
        if (!"ADMIN".equals(currentUser.getRole().name()) && !"MANAGER".equals(currentUser.getRole().name()) && !currentUser.getId().equals(providerId)) {
            return ResponseEntity.status(403).build();
        }
        // Enforce tenant boundary
        List<ProviderShiftLog> shifts = shiftLogRepository.findByProviderId(providerId);
        if (!shifts.isEmpty() && !shifts.get(0).getOrganizationId().equals(currentUser.getOrganizationId())) {
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(shifts);
    }

    // ── PAYOUTS ENDPOINTS ────────────────────────────────────

    @PostMapping("/generate")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<ProviderPayout> generatePayout(
            @RequestParam String providerId,
            @RequestParam String periodStart, // YYYY-MM-DD
            @RequestParam String periodEnd,
            @RequestParam String organizationId) {
        User currentUser = getCurrentUser();
        if (!"ADMIN".equals(currentUser.getRole().name()) && !currentUser.getOrganizationId().equals(organizationId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        LocalDate start = LocalDate.parse(periodStart);
        LocalDate end = LocalDate.parse(periodEnd);
        return ResponseEntity.ok(payoutService.generatePayout(providerId, start, end, organizationId));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<List<ProviderPayout>> getPayouts(@RequestParam String organizationId) {
        User currentUser = getCurrentUser();
        if (!"ADMIN".equals(currentUser.getRole().name()) && !currentUser.getOrganizationId().equals(organizationId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(payoutService.getPayoutsByOrg(organizationId));
    }

    @PutMapping("/{id}/approve")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<ProviderPayout> approvePayout(@PathVariable String id) {
        User currentUser = getCurrentUser();
        String approvedBy = currentUser.getFirstName() + " " + currentUser.getLastName();
        return ResponseEntity.ok(payoutService.approvePayout(id, approvedBy, currentUser.getOrganizationId()));
    }

    @PutMapping("/{id}/mark-paid")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<ProviderPayout> markPaid(@PathVariable String id) {
        User currentUser = getCurrentUser();
        return ResponseEntity.ok(payoutService.markPaid(id, currentUser.getOrganizationId()));
    }

    @GetMapping("/me")
    @PreAuthorize("hasAnyRole('PHYSICIAN', 'PARAMEDIC')")
    public ResponseEntity<List<ProviderPayout>> getMyPayouts() {
        User currentUser = getCurrentUser();
        return ResponseEntity.ok(payoutService.getPayoutsByProvider(currentUser.getId()));
    }

    @DeleteMapping("/rates/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Void> deleteRate(@PathVariable String id) {
        User currentUser = getCurrentUser();
        payoutService.deleteRate(id, currentUser.getOrganizationId());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Void> deletePayout(@PathVariable String id) {
        User currentUser = getCurrentUser();
        payoutService.deletePayout(id, currentUser.getOrganizationId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/shifts/clock-in")
    public ResponseEntity<ProviderShiftLog> clockIn() {
        User currentUser = getCurrentUser();
        return ResponseEntity.ok(payoutService.clockIn(currentUser.getId(), currentUser.getOrganizationId()));
    }

    @PostMapping("/shifts/clock-out")
    public ResponseEntity<ProviderShiftLog> clockOut() {
        User currentUser = getCurrentUser();
        return ResponseEntity.ok(payoutService.clockOut(currentUser.getId()));
    }

    @GetMapping("/shifts/active")
    public ResponseEntity<ProviderShiftLog> getActiveShift() {
        User currentUser = getCurrentUser();
        ProviderShiftLog activeShift = shiftLogRepository.findByProviderIdAndStatus(currentUser.getId(), "OPEN")
                .stream().findFirst().orElse(null);
        return ResponseEntity.ok(activeShift);
    }

    @PostMapping("/shifts/manual")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<ProviderShiftLog> logManualShift(
            @RequestParam String providerId,
            @RequestParam String start,
            @RequestParam String end) {
        User currentUser = getCurrentUser();
        java.time.LocalDateTime startTime = java.time.LocalDateTime.parse(start);
        java.time.LocalDateTime endTime = java.time.LocalDateTime.parse(end);
        return ResponseEntity.ok(payoutService.logManualShift(providerId, startTime, endTime, currentUser.getOrganizationId()));
    }

    @DeleteMapping("/shifts/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Void> deleteShiftLog(@PathVariable String id) {
        User currentUser = getCurrentUser();
        payoutService.deleteShiftLog(id, currentUser.getOrganizationId());
        return ResponseEntity.noContent().build();
    }
}
