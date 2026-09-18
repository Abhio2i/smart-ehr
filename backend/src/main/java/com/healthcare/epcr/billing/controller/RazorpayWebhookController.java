package com.healthcare.epcr.billing.controller;

import com.healthcare.epcr.billing.service.ClaimService;
import com.healthcare.epcr.billing.service.RazorpayService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * RazorpayWebhookController — handles inbound Razorpay payment event webhooks.
 *
 * Supported Webhook URLs:
 *   POST /api/webhooks/razorpay
 *   POST /api/billing/webhook/razorpay
 *
 * Handled Events:
 *   - payment_link.paid
 *   - payment.captured
 *   - order.paid
 */
@RestController
@RequestMapping({"/api/webhooks/razorpay", "/api/billing/webhook/razorpay"})
@RequiredArgsConstructor
@Slf4j
public class RazorpayWebhookController {

    private final RazorpayService razorpayService;
    private final ClaimService claimService;

    @PostMapping({"", "/{organizationId}"})
    public ResponseEntity<Map<String, String>> handleWebhook(
            @PathVariable(required = false) String organizationId,
            @RequestBody String rawBody,
            @RequestHeader(value = "X-Razorpay-Signature", required = false) String signature) {

        log.info("📬 Razorpay webhook received | org={}", organizationId);

        // Verify HMAC-SHA256 signature if signature header is provided
        if (signature != null && !signature.isBlank()) {
            boolean valid = razorpayService.verifyWebhookSignatureForOrg(rawBody, signature, organizationId);
            if (!valid) {
                log.warn("🚫 Razorpay webhook signature verification FAILED for org {} — rejecting request", organizationId);
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid signature"));
            }
        }

        try {
            JSONObject event = new JSONObject(rawBody);
            String eventType = event.optString("event", "");
            String orgId = organizationId;
            log.info("📬 Razorpay event: {}", eventType);

            if ("payment_link.paid".equals(eventType) || "payment.captured".equals(eventType) || "order.paid".equals(eventType)) {
                JSONObject payload = event.optJSONObject("payload");
                String claimId = "";
                String paymentId = "";

                if (payload != null) {
                    JSONObject payEntity = payload.optJSONObject("payment") != null 
                        ? payload.optJSONObject("payment").optJSONObject("entity") : null;
                    JSONObject plinkEntity = payload.optJSONObject("payment_link") != null 
                        ? payload.optJSONObject("payment_link").optJSONObject("entity") : null;

                    if (payEntity != null) {
                        paymentId = payEntity.optString("id", "");
                        String receipt = payEntity.optString("receipt", "");
                        claimId = receipt.replace("CLAIM-", "").trim();

                        JSONObject notes = payEntity.optJSONObject("notes");
                        if (claimId.isEmpty() && notes != null) {
                            claimId = notes.optString("claimId", "");
                        }
                        if ((orgId == null || orgId.isBlank()) && notes != null) {
                            orgId = notes.optString("organizationId", "");
                        }
                    }

                    if (claimId.isEmpty() && plinkEntity != null) {
                        JSONObject notes = plinkEntity.optJSONObject("notes");
                        if (notes != null) {
                            claimId = notes.optString("claimId", "");
                            if (orgId == null || orgId.isBlank()) {
                                orgId = notes.optString("organizationId", "");
                            }
                        }
                        if (paymentId.isEmpty()) {
                            paymentId = plinkEntity.optString("id", "");
                        }
                    }

                    log.info("✅ Extracted from Webhook: event={} claimId={} paymentId={} orgId={}", eventType, claimId, paymentId, orgId);

                    if (!claimId.isEmpty()) {
                        try {
                            claimService.payClaimViaWebhook(claimId, paymentId, orgId);
                            log.info("✅ Claim {} marked PAID via webhook callback", claimId);
                        } catch (Exception e) {
                            log.warn("⚠️ Webhook: claim {} settlement failed — {}", claimId, e.getMessage(), e);
                        }
                    } else {
                        log.warn("⚠️ Razorpay webhook event {} received but no claimId found in payload", eventType);
                    }
                }
            }

            return ResponseEntity.ok(Map.of("status", "processed"));

        } catch (Exception e) {
            log.error("❌ Razorpay webhook processing error: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Processing error"));
        }
    }
}
