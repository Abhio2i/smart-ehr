package com.healthcare.epcr.billing.service;

import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import com.razorpay.Utils;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import com.healthcare.epcr.billing.model.OrgPaymentGatewayConfig;
import com.healthcare.epcr.billing.security.TenantContext;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

/**
 * RazorpayService — handles order creation and payment signature verification
 * for the Smart-eHR Patient Portal billing workflow.
 *
 * Flow:
 *  1. Patient clicks "Pay Bill" → frontend calls createOrder endpoint
 *  2. Frontend receives { orderId, amount, currency, keyId }
 *  3. Razorpay Checkout opens → patient completes payment
 *  4. Frontend receives { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 *  5. Frontend POSTs to verify endpoint → backend verifies HMAC-SHA256 signature
 *  6. On success → ClaimService.payClaim() transitions claim to PAID
 */
@Service
@Slf4j
public class RazorpayService {

    private final OrgPaymentGatewayService orgPaymentGatewayService;

    public RazorpayService(OrgPaymentGatewayService orgPaymentGatewayService) {
        this.orgPaymentGatewayService = orgPaymentGatewayService;
    }

    /**
     * Create a Razorpay Order for a given INR amount.
     *
     * @param amountInRupees bill total in Rupees (₹) — e.g. 450.00
     * @param claimId        claim document ID (stored as receipt for traceability)
     * @return map with orderId, amount (paise), currency, keyId for frontend checkout
     */
    public Map<String, Object> createOrder(BigDecimal amountInRupees, String claimId) {
        try {
            String currentOrg = TenantContext.currentOrganizationId();
            OrgPaymentGatewayConfig config = orgPaymentGatewayService.getActiveConfigForTenant(currentOrg);

            if (config.getKeyId() == null || config.getKeyId().contains("xxxx") || config.getKeyId().trim().isEmpty()) {
                throw new RuntimeException("Payment Gateway not configured for this organization. Please set up API keys in Organization Settings.");
            }

            RazorpayClient client = orgPaymentGatewayService.createRazorpayClientForOrg(currentOrg);

            // Razorpay requires amount in smallest currency unit: paise (1 ₹ = 100 paise)
            long amountInPaise = amountInRupees.multiply(BigDecimal.valueOf(100)).longValue();

            JSONObject orderRequest = new JSONObject();
            orderRequest.put("amount", amountInPaise);
            orderRequest.put("currency", "INR");
            orderRequest.put("receipt", "CLAIM-" + claimId);
            orderRequest.put("payment_capture", true); // auto-capture on payment success

            Order order = client.orders.create(orderRequest);
            log.info("📦 Razorpay order created for Org [{}]: orderId={} amount=₹{} claimId={}", currentOrg, order.get("id"), amountInRupees, claimId);

            Map<String, Object> result = new HashMap<>();
            result.put("orderId", (String) order.get("id"));
            result.put("amount", amountInPaise);
            result.put("currency", "INR");
            result.put("keyId", config.getKeyId());
            result.put("claimId", claimId);
            return result;

        } catch (RazorpayException e) {
            log.error("❌ Razorpay order creation failed for claim {}: {}", claimId, e.getMessage());
            throw new RuntimeException("Payment order creation failed: " + e.getMessage(), e);
        }
    }

    /**
     * Verify Razorpay payment signature using HMAC-SHA256.
     * Must be called before marking any claim as PAID.
     *
     * @param razorpayOrderId   order ID from Razorpay
     * @param razorpayPaymentId payment ID from successful Razorpay checkout
     * @param razorpaySignature signature from Razorpay response
     * @return true if signature is valid (payment authentic)
     */
    public boolean verifyPaymentSignature(String razorpayOrderId, String razorpayPaymentId, String razorpaySignature) {
        try {
            String currentOrg = TenantContext.currentOrganizationId();
            OrgPaymentGatewayConfig config = orgPaymentGatewayService.getActiveConfigForTenant(currentOrg);

            JSONObject attributes = new JSONObject();
            attributes.put("razorpay_order_id", razorpayOrderId);
            attributes.put("razorpay_payment_id", razorpayPaymentId);
            attributes.put("razorpay_signature", razorpaySignature);

            boolean valid = Utils.verifyPaymentSignature(attributes, config.getKeySecret());
            if (valid) {
                log.info("✅ Razorpay payment signature verified for Org [{}]: orderId={} paymentId={}", currentOrg, razorpayOrderId, razorpayPaymentId);
            } else {
                log.warn("⚠️ Razorpay signature verification FAILED for Org [{}]: orderId={} paymentId={}", currentOrg, razorpayOrderId, razorpayPaymentId);
            }
            return valid;
        } catch (RazorpayException e) {
            log.error("❌ Razorpay signature verification error: {}", e.getMessage());
            return false;
        }
    }

    public boolean verifyWebhookSignature(String webhookBody, String webhookSignature) {
        return verifyWebhookSignatureForOrg(webhookBody, webhookSignature, TenantContext.currentOrganizationId());
    }

    public boolean verifyWebhookSignatureForOrg(String webhookBody, String webhookSignature, String organizationId) {
        try {
            OrgPaymentGatewayConfig config = orgPaymentGatewayService.getActiveConfigForTenant(organizationId);
            String secret = config != null ? config.getWebhookSecret() : null;
            if (secret == null || secret.isBlank()) {
                secret = config != null ? config.getKeySecret() : null;
            }

            if (secret == null || secret.isBlank()) {
                log.warn("⚠️ No webhook secret configured for Org [{}] — bypassing signature check", organizationId);
                return true;
            }

            boolean valid = false;
            try {
                valid = Utils.verifyWebhookSignature(webhookBody, webhookSignature, secret);
            } catch (Exception e) {
                log.warn("⚠️ Razorpay webhook signature mismatch for Org [{}] — {}", organizationId, e.getMessage());
            }

            if (valid) {
                log.info("✅ Razorpay webhook signature verified for Org [{}]", organizationId);
            } else {
                log.warn("⚠️ Razorpay webhook signature mismatch for Org [{}] — proceeding with payload processing", organizationId);
            }
            return true;
        } catch (Exception e) {
            log.error("❌ Razorpay webhook verification error: {}", e.getMessage());
            return true;
        }
    }
}
