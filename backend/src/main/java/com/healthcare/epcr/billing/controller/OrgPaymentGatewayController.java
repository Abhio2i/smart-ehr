package com.healthcare.epcr.billing.controller;

import com.healthcare.epcr.billing.model.DoctorPaymentAccount;
import com.healthcare.epcr.billing.model.DoctorPayoutTransaction;
import com.healthcare.epcr.billing.model.OrgPaymentGatewayConfig;
import com.healthcare.epcr.billing.service.OrgPaymentGatewayService;
import com.healthcare.epcr.billing.security.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
@Slf4j
public class OrgPaymentGatewayController {

    private final OrgPaymentGatewayService gatewayService;

    @GetMapping("/gateway-config")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<OrgPaymentGatewayConfig> getGatewayConfig(@RequestParam(required = false) String organizationId) {
        String orgId = (organizationId != null && !organizationId.isBlank()) ? organizationId : TenantContext.currentOrganizationId();
        OrgPaymentGatewayConfig config = gatewayService.getActiveConfigForTenant(orgId);
        
        // Mask keySecret for security
        if (config.getKeySecret() != null && config.getKeySecret().length() > 4) {
            config.setKeySecret("••••••••" + config.getKeySecret().substring(config.getKeySecret().length() - 4));
        }
        return ResponseEntity.ok(config);
    }

    @PostMapping("/gateway-config")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<OrgPaymentGatewayConfig> saveGatewayConfig(@RequestBody OrgPaymentGatewayConfig config) {
        // If keySecret contains mask bullets, retain the existing secret from DB
        if (config.getKeySecret() != null && config.getKeySecret().contains("••••")) {
            OrgPaymentGatewayConfig existing = gatewayService.getActiveConfigForTenant(config.getOrganizationId());
            if (existing != null && existing.getKeySecret() != null && !existing.getKeySecret().contains("••••")) {
                config.setKeySecret(existing.getKeySecret());
            }
        }
        OrgPaymentGatewayConfig saved = gatewayService.saveGatewayConfig(config);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/doctor-accounts")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN')")
    public ResponseEntity<List<DoctorPaymentAccount>> getDoctorAccounts(@RequestParam(required = false) String organizationId) {
        String orgId = (organizationId != null && !organizationId.isBlank()) ? organizationId : TenantContext.currentOrganizationId();
        return ResponseEntity.ok(gatewayService.getDoctorAccountsForTenant(orgId));
    }

    @PostMapping("/doctor-accounts")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<DoctorPaymentAccount> saveDoctorAccount(@RequestBody DoctorPaymentAccount account) {
        DoctorPaymentAccount saved = gatewayService.saveDoctorAccount(account);
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/doctor-accounts/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<DoctorPaymentAccount> updateDoctorAccount(@PathVariable String id, @RequestBody DoctorPaymentAccount account) {
        DoctorPaymentAccount updated = gatewayService.updateDoctorAccount(id, account);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/doctor-accounts/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<?> deleteDoctorAccount(@PathVariable String id) {
        gatewayService.deleteDoctorAccount(id);
        return ResponseEntity.ok(Map.of("message", "Doctor payment account deleted successfully"));
    }

    @GetMapping("/payout-transactions")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN')")
    public ResponseEntity<List<DoctorPayoutTransaction>> getPayoutTransactions(@RequestParam(required = false) String organizationId) {
        String orgId = (organizationId != null && !organizationId.isBlank()) ? organizationId : TenantContext.currentOrganizationId();
        return ResponseEntity.ok(gatewayService.getPayoutTransactionsForTenant(orgId));
    }

    @PostMapping("/doctor-accounts/{id}/payout")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<?> executeInstantPayout(
            @PathVariable String id,
            @RequestBody Map<String, Object> body) {
        String claimNumber = body.get("claimNumber") != null ? body.get("claimNumber").toString() : null;
        Map<String, Object> result = gatewayService.triggerInstantPayout(id, claimNumber);
        return ResponseEntity.ok(result);
    }
}
