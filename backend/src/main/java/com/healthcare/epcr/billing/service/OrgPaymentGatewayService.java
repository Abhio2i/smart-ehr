package com.healthcare.epcr.billing.service;

import com.healthcare.epcr.billing.model.DoctorPaymentAccount;
import com.healthcare.epcr.billing.model.DoctorPayoutTransaction;
import com.healthcare.epcr.billing.model.HealthCareClaim;
import com.healthcare.epcr.billing.model.OrgPaymentGatewayConfig;
import com.healthcare.epcr.billing.repository.DoctorPaymentAccountRepository;
import com.healthcare.epcr.billing.repository.DoctorPayoutTransactionRepository;
import com.healthcare.epcr.billing.repository.HealthCareClaimRepository;
import com.healthcare.epcr.billing.repository.OrgPaymentGatewayConfigRepository;
import com.healthcare.epcr.billing.security.TenantContext;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrgPaymentGatewayService {

    private final OrgPaymentGatewayConfigRepository gatewayConfigRepository;
    private final DoctorPaymentAccountRepository doctorPaymentAccountRepository;
    private final HealthCareClaimRepository healthCareClaimRepository;
    private final DoctorPayoutTransactionRepository doctorPayoutTransactionRepository;
    private final RazorpayPayoutService razorpayPayoutService;

    @Value("${razorpay.key-id:${RAZORPAY_KEY_ID:rzp_test_xxxxxxxxxxxxxxxx}}")
    private String defaultKeyId;

    @Value("${razorpay.key-secret:${RAZORPAY_KEY_SECRET:xxxxxxxxxxxxxxxxxxxxxxxx}}")
    private String defaultKeySecret;

    @Value("${razorpay.webhook-secret:${RAZORPAY_WEBHOOK_SECRET:xxxxxxxxxxxxxxxxxxxxxxxx}}")
    private String defaultWebhookSecret;

    public OrgPaymentGatewayConfig getActiveConfigForTenant(String organizationId) {
        String callerOrg = TenantContext.currentOrganizationId();
        String orgId;

        if (TenantContext.hasRole("ADMIN") && organizationId != null && !organizationId.isBlank()) {
            orgId = organizationId; // Platform Admin cross-org access allowed
        } else if (callerOrg != null && !callerOrg.isBlank()) {
            orgId = callerOrg; // Everyone else: force to caller's own org
        } else if (organizationId != null && !organizationId.isBlank()) {
            orgId = organizationId; // Unauthenticated webhook / system lookup
        } else {
            orgId = "DEFAULT";
        }

        if (!"DEFAULT".equals(orgId)) {
            Optional<OrgPaymentGatewayConfig> configOpt = gatewayConfigRepository.findByOrganizationIdAndActiveTrue(orgId);
            if (configOpt.isPresent()) {
                return configOpt.get();
            }
        }

        // SECURITY: Do NOT leak default keys to unconfigured organizations. Return unconfigured inactive state.
        return OrgPaymentGatewayConfig.builder()
                .organizationId(orgId)
                .provider("RAZORPAY")
                .keyId(null)
                .keySecret(null)
                .webhookSecret(null)
                .merchantId(null)
                .active(false)
                .build();
    }

    public OrgPaymentGatewayConfig saveGatewayConfig(OrgPaymentGatewayConfig config) {
        String currentOrg = TenantContext.currentOrganizationId();
        boolean isPlatformAdmin = TenantContext.hasRole("ADMIN");

        if (isPlatformAdmin && config.getOrganizationId() != null && !config.getOrganizationId().isBlank()) {
            // Platform admin explicitly configuring a specific org's gateway — trust client-supplied orgId
        } else if (currentOrg != null && !currentOrg.isBlank()) {
            config.setOrganizationId(currentOrg); // Everyone else: force to caller's own org
        } else {
            throw new IllegalStateException("Cannot determine organization for gateway config");
        }

        Optional<OrgPaymentGatewayConfig> existingOpt = gatewayConfigRepository.findByOrganizationId(config.getOrganizationId());
        if (existingOpt.isPresent()) {
            OrgPaymentGatewayConfig existing = existingOpt.get();
            existing.setProvider(config.getProvider());
            existing.setKeyId(config.getKeyId());
            existing.setKeySecret(config.getKeySecret());
            existing.setWebhookSecret(config.getWebhookSecret());
            existing.setMerchantId(config.getMerchantId());
            existing.setActive(config.getActive() != null ? config.getActive() : true);
            log.info("Updated Payment Gateway Config for Organization: {}", config.getOrganizationId());
            return gatewayConfigRepository.save(existing);
        }

        log.info("Created new Payment Gateway Config for Organization: {}", config.getOrganizationId());
        return gatewayConfigRepository.save(config);
    }

    public RazorpayClient createRazorpayClientForOrg(String organizationId) throws RazorpayException {
        OrgPaymentGatewayConfig config = getActiveConfigForTenant(organizationId);
        if (config.getKeyId() == null || config.getKeyId().contains("xxxx")) {
            throw new IllegalStateException("Payment Gateway not configured for Organization: " + organizationId);
        }
        return new RazorpayClient(config.getKeyId(), config.getKeySecret());
    }

    public DoctorPaymentAccount saveDoctorAccount(DoctorPaymentAccount account) {
        String currentOrg = TenantContext.currentOrganizationId();
        boolean isPlatformAdmin = TenantContext.hasRole("ADMIN");

        if (isPlatformAdmin && account.getOrganizationId() != null && !account.getOrganizationId().isBlank()) {
            // Platform admin setting for specified org
        } else if (currentOrg != null && !currentOrg.isBlank()) {
            account.setOrganizationId(currentOrg); // Everyone else: force to caller's own org
        } else {
            throw new IllegalStateException("Cannot determine organization for doctor payment account");
        }

        Optional<DoctorPaymentAccount> existing = doctorPaymentAccountRepository
                .findByOrganizationIdAndDoctorUserId(account.getOrganizationId(), account.getDoctorUserId());

        if (existing.isPresent()) {
            DoctorPaymentAccount ex = existing.get();
            ex.setDoctorName(account.getDoctorName());
            ex.setAccountType(account.getAccountType());
            ex.setAccountNumber(account.getAccountNumber());
            ex.setIfscCode(account.getIfscCode());
            ex.setUpiId(account.getUpiId());
            ex.setLinkedAccountRef(account.getLinkedAccountRef());
            ex.setCommissionPercent(account.getCommissionPercent());
            ex.setActive(account.getActive() != null ? account.getActive() : true);
            return doctorPaymentAccountRepository.save(ex);
        }

        return doctorPaymentAccountRepository.save(account);
    }

    public List<DoctorPaymentAccount> getDoctorAccountsForTenant(String organizationId) {
        String callerOrg = TenantContext.currentOrganizationId();
        String orgId;

        if (TenantContext.hasRole("ADMIN") && organizationId != null && !organizationId.isBlank()) {
            orgId = organizationId; // Platform Admin cross-org access allowed
        } else if (callerOrg != null && !callerOrg.isBlank()) {
            orgId = callerOrg; // Everyone else: force to caller's own org, ignore param
        } else if (organizationId != null && !organizationId.isBlank()) {
            orgId = organizationId;
        } else {
            orgId = null;
        }

        if (orgId == null || orgId.isBlank()) {
            return List.of();
        }
        return doctorPaymentAccountRepository.findByOrganizationId(orgId);
    }

    public DoctorPaymentAccount updateDoctorAccount(String id, DoctorPaymentAccount account) {
        String currentOrg = TenantContext.currentOrganizationId();
        boolean isPlatformAdmin = TenantContext.hasRole("ADMIN");

        DoctorPaymentAccount existing = doctorPaymentAccountRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Doctor payment account not found: " + id));

        if (!isPlatformAdmin && currentOrg != null && !currentOrg.equals(existing.getOrganizationId())) {
            throw new org.springframework.security.access.AccessDeniedException("Access denied to doctor account");
        }

        if (account.getDoctorName() != null) existing.setDoctorName(account.getDoctorName());
        if (account.getAccountType() != null) existing.setAccountType(account.getAccountType());
        if (account.getAccountNumber() != null) existing.setAccountNumber(account.getAccountNumber());
        if (account.getIfscCode() != null) existing.setIfscCode(account.getIfscCode());
        if (account.getUpiId() != null) existing.setUpiId(account.getUpiId());
        if (account.getLinkedAccountRef() != null) existing.setLinkedAccountRef(account.getLinkedAccountRef());
        if (account.getCommissionPercent() != null) existing.setCommissionPercent(account.getCommissionPercent());
        if (account.getActive() != null) existing.setActive(account.getActive());

        return doctorPaymentAccountRepository.save(existing);
    }

    public void deleteDoctorAccount(String id) {
        String currentOrg = TenantContext.currentOrganizationId();
        boolean isPlatformAdmin = TenantContext.hasRole("ADMIN");

        Optional<DoctorPaymentAccount> existingOpt = doctorPaymentAccountRepository.findById(id);
        if (existingOpt.isPresent()) {
            DoctorPaymentAccount existing = existingOpt.get();
            if (!isPlatformAdmin && currentOrg != null && !currentOrg.equals(existing.getOrganizationId())) {
                throw new org.springframework.security.access.AccessDeniedException("Access denied to doctor account");
            }
            doctorPaymentAccountRepository.deleteById(id);
            log.info("Deleted doctor payment account: {} for org: {}", id, existing.getOrganizationId());
        }
    }

    public List<DoctorPayoutTransaction> getPayoutTransactionsForTenant(String organizationId) {
        String callerOrg = TenantContext.currentOrganizationId();
        boolean isPlatformAdmin = TenantContext.hasRole("ADMIN");
        String effectiveOrgId = (isPlatformAdmin && organizationId != null && !organizationId.isBlank()) ? organizationId : callerOrg;
        if (effectiveOrgId == null || effectiveOrgId.isBlank()) {
            return java.util.Collections.emptyList();
        }
        return doctorPayoutTransactionRepository.findByOrganizationId(effectiveOrgId);
    }

    public java.util.Map<String, Object> triggerInstantPayout(String accountId, String claimNumber) {
        String currentOrg = TenantContext.currentOrganizationId();
        boolean isPlatformAdmin = TenantContext.hasRole("ADMIN");

        DoctorPaymentAccount account = doctorPaymentAccountRepository.findById(accountId)
                .orElseThrow(() -> new IllegalArgumentException("Doctor payment account not found with ID: " + accountId));

        // FAIL-CLOSED Authorization Check
        if (!isPlatformAdmin) {
            if (currentOrg == null || currentOrg.isBlank() || !currentOrg.equals(account.getOrganizationId())) {
                throw new org.springframework.security.access.AccessDeniedException("Unauthorized cross-tenant access to doctor account");
            }
        }

        String effectiveOrgId = isPlatformAdmin ? account.getOrganizationId() : currentOrg;
        if (claimNumber == null || claimNumber.isBlank()) {
            throw new IllegalArgumentException("Valid claimNumber is required for instant payout execution.");
        }

        // SERVER-SIDE COMMISSION CALCULATION (Do NOT trust client-supplied amount)
        HealthCareClaim claim = healthCareClaimRepository.findByOrganizationIdAndClaimNumber(effectiveOrgId, claimNumber)
                .orElseThrow(() -> new IllegalArgumentException("Claim not found for claimNumber: " + claimNumber + " in org: " + effectiveOrgId));

        if ("DRAFT".equalsIgnoreCase(claim.getStatus()) || "REJECTED".equalsIgnoreCase(claim.getStatus())) {
            throw new IllegalStateException("Claim #" + claimNumber + " is in " + claim.getStatus() + " status. Payout is not permitted for unvalidated or rejected claims.");
        }

        double claimTotal = claim.getTotalAmount() != null ? claim.getTotalAmount() : 0.0;
        double commPercent = (account.getCommissionPercent() != null) ? account.getCommissionPercent().doubleValue() : 0.0;
        if (commPercent <= 0) {
            throw new IllegalStateException("Doctor account has no active commission rate configured.");
        }

        double serverCalculatedPayout = claimTotal * (commPercent / 100.0);
        if (serverCalculatedPayout <= 0) {
            throw new IllegalStateException("Calculated payout amount is zero or invalid.");
        }

        // IDEMPOTENCY CHECK — Prevent duplicate payouts for same claim and doctor
        Optional<DoctorPayoutTransaction> existingTx = doctorPayoutTransactionRepository
                .findByOrganizationIdAndClaimNumberAndDoctorAccountId(effectiveOrgId, claimNumber, accountId);

        if (existingTx.isPresent()) {
            DoctorPayoutTransaction tx = existingTx.get();
            if ("PROCESSED".equalsIgnoreCase(tx.getStatus()) || "PROCESSING".equalsIgnoreCase(tx.getStatus())) {
                throw new IllegalStateException("Instant payout already " + tx.getStatus() + " for Claim #" + claimNumber + " (Payout ID: " + tx.getRazorpayPayoutId() + "). Duplicate payouts are blocked.");
            }
        }

        // Save PENDING transaction audit record
        DoctorPayoutTransaction txRecord = DoctorPayoutTransaction.builder()
                .organizationId(effectiveOrgId)
                .claimNumber(claimNumber)
                .doctorAccountId(accountId)
                .doctorUserId(account.getDoctorUserId())
                .doctorName(account.getDoctorName())
                .upiId(account.getUpiId())
                .claimTotalAmount(claimTotal)
                .commissionPercent(commPercent)
                .payoutAmount(serverCalculatedPayout)
                .status("PROCESSING")
                .initiatedByUserId(TenantContext.currentUserId())
                .createdAt(java.time.LocalDateTime.now())
                .updatedAt(java.time.LocalDateTime.now())
                .build();

        txRecord = doctorPayoutTransactionRepository.save(txRecord);

        try {
            String targetUpi = (account.getUpiId() != null && !account.getUpiId().isBlank()) ? account.getUpiId() : "doctor@upi";
            java.util.Map<String, Object> payoutResult = razorpayPayoutService.executeUpiPayout(
                    targetUpi,
                    serverCalculatedPayout,
                    account.getDoctorName(),
                    claimNumber,
                    effectiveOrgId
            );

            txRecord.setStatus(String.valueOf(payoutResult.getOrDefault("status", "PROCESSED")));
            txRecord.setRazorpayPayoutId(String.valueOf(payoutResult.getOrDefault("payoutId", "")));
            txRecord.setMode(String.valueOf(payoutResult.getOrDefault("mode", "RAZORPAYX_UPI")));
            txRecord.setResponseMessage(String.valueOf(payoutResult.getOrDefault("message", "Success")));
            txRecord.setUpdatedAt(java.time.LocalDateTime.now());
            doctorPayoutTransactionRepository.save(txRecord);

            return payoutResult;

        } catch (Exception ex) {
            txRecord.setStatus("FAILED");
            txRecord.setResponseMessage(ex.getMessage());
            txRecord.setUpdatedAt(java.time.LocalDateTime.now());
            doctorPayoutTransactionRepository.save(txRecord);
            throw ex;
        }
    }
}
