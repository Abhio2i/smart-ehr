package com.healthcare.epcr.billing.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
@Slf4j
public class RazorpayPayoutService {

    // ─── Global fallback keys from .env (used ONLY if org has no keys in DB)
    @Value("${razorpayx.key.id:}")
    private String keyId;

    @Value("${razorpayx.key.secret:}")
    private String keySecret;

    @Value("${razorpayx.account.number:}")
    private String razorpayxAccountNumber;

    private final RestTemplate restTemplate = new RestTemplate();

    /**
     * Simple call — uses .env keys as fallback.
     */
    public Map<String, Object> executeUpiPayout(
            String doctorUpiId,
            double amountInRupees,
            String doctorName,
            String claimNumber,
            String orgId) {
        return executeUpiPayout(doctorUpiId, amountInRupees, doctorName, claimNumber, orgId, null, null, null);
    }

    /**
     * PRIMARY METHOD — Uses org-specific keys from DB (UI mein paste ki gayi keys).
     *
     * Priority order:
     *   1st: orgKeyId / orgKeySecret / orgAccountNumber  (DB se — UI ke Gateway Config se)
     *   2nd: .env RAZORPAYX_* variables                  (global fallback)
     *   3rd: Simulation mode                              (agar koi keys nahi hain)
     */
    public Map<String, Object> executeUpiPayout(
            String doctorUpiId,
            double amountInRupees,
            String doctorName,
            String claimNumber,
            String orgId,
            String orgKeyId,
            String orgKeySecret,
            String orgAccountNumber) {

        if (doctorUpiId == null || doctorUpiId.isBlank()) {
            throw new IllegalArgumentException("Doctor UPI ID (VPA) is missing.");
        }
        if (amountInRupees <= 0) {
            throw new IllegalArgumentException("Payout amount must be greater than zero.");
        }

        // Step 1: Best available keys resolve karo
        String effectiveKeyId     = resolve(orgKeyId,        keyId);
        String effectiveKeySecret = resolve(orgKeySecret,    keySecret);
        String effectiveAccount   = resolve(orgAccountNumber, razorpayxAccountNumber);

        long amountInPaise = Math.round(amountInRupees * 100);
        String safeName = (doctorName != null && !doctorName.isBlank()) ? doctorName : "Doctor Partner";

        // Step 2: Koi valid key nahi → Simulation mode
        boolean hasKeys = isValidKey(effectiveKeyId) && isValidKey(effectiveKeySecret) && isValidKey(effectiveAccount);

        if (!hasKeys) {
            log.info("[AutoSplit] SIMULATED ₹{} → {} | Dr. {} | Claim {} | Org: {} | (Add RazorpayX keys in Org Gateway Config UI for live transfers)",
                    String.format("%.2f", amountInRupees), doctorUpiId, safeName, claimNumber, orgId);
            return Map.of(
                    "status",    "PROCESSED",
                    "mode",      "SIMULATED_UPI",
                    "payoutId",  "pout_sim_" + UUID.randomUUID().toString().substring(0, 12),
                    "upiId",     doctorUpiId,
                    "amount",    amountInRupees,
                    "message",   "Simulated. Paste RazorpayX keys in: Provider Payments → Org Gateway & Accounts → Save."
            );
        }

        // Step 3: Live RazorpayX API call
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            String auth = effectiveKeyId + ":" + effectiveKeySecret;
            headers.set("Authorization", "Basic " + Base64.getEncoder().encodeToString(auth.getBytes(StandardCharsets.UTF_8)));
            headers.set("X-Payout-Idempotency", "PAYOUT-" + claimNumber + "-" + orgId);

            Map<String, Object> body = new HashMap<>();
            body.put("account_number", effectiveAccount);
            body.put("amount", amountInPaise);
            body.put("currency", "INR");
            body.put("mode", "UPI");
            body.put("purpose", "payout");
            body.put("queue_if_low_balance", true);
            body.put("reference_id", "SPLIT-" + claimNumber + "-" + System.currentTimeMillis());
            body.put("fund_account", Map.of(
                    "account_type", "vpa",
                    "vpa",         Map.of("address", doctorUpiId),
                    "contact",     Map.of("name", safeName, "type", "vendor")
            ));

            ResponseEntity<Map> response = restTemplate.postForEntity(
                    "https://api.razorpay.com/v1/payouts",
                    new HttpEntity<>(body, headers),
                    Map.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map respBody = response.getBody();
                String payoutId = String.valueOf(respBody.getOrDefault("id",     "pout_unknown"));
                String status   = String.valueOf(respBody.getOrDefault("status", "processed"));
                log.info("[AutoSplit] ✅ LIVE Transfer SUCCESS | PayoutId: {} | ₹{} → {} | Org: {}",
                        payoutId, amountInRupees, doctorUpiId, orgId);
                return Map.of(
                        "status",   status.toUpperCase(),
                        "mode",     "RAZORPAYX_UPI",
                        "payoutId", payoutId,
                        "upiId",    doctorUpiId,
                        "amount",   amountInRupees,
                        "message",  "Live RazorpayX UPI split completed."
                );
            }
            throw new IllegalStateException("RazorpayX returned: " + response.getStatusCode());

        } catch (Exception ex) {
            log.error("[AutoSplit] ❌ Transfer FAILED → {}: {}", doctorUpiId, ex.getMessage());
            throw new RuntimeException("UPI Split failed: " + ex.getMessage(), ex);
        }
    }

    /** Org key prefer karo, .env fallback lo **/
    private String resolve(String orgValue, String envValue) {
        return (orgValue != null && !orgValue.isBlank()) ? orgValue : envValue;
    }

    /** Valid key = non-null, non-blank, no placeholder text **/
    private boolean isValidKey(String key) {
        return key != null && !key.isBlank()
                && !key.contains("REPLACE") && !key.contains("xxxx") && !key.contains("XXXX");
    }
}
