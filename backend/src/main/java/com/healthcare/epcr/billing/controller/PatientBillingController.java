package com.healthcare.epcr.billing.controller;

import com.healthcare.epcr.billing.dto.ClaimSummaryDTO;
import com.healthcare.epcr.billing.model.Claim;
import com.healthcare.epcr.billing.service.ClaimService;
import com.healthcare.epcr.billing.service.RazorpayService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

/**
 * PatientBillingController — patient-facing billing and payment endpoints.
 *
 * Razorpay payment flow:
 *  1. POST /razorpay-order  → creates Razorpay order, returns { orderId, amount, keyId }
 *  2. Frontend opens Razorpay Checkout
 *  3. POST /razorpay-verify → verifies HMAC-SHA256 signature, settles claim to PAID
 */
@RestController
@RequestMapping("/api/patient-portal/billing")
@RequiredArgsConstructor
@Slf4j
public class PatientBillingController {

    private final ClaimService claimService;
    private final RazorpayService razorpayService;

    // ─── Patient claims list ───────────────────────────────────────────────
    @GetMapping("/claims")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Page<ClaimSummaryDTO>> myClaims(Pageable pageable) {
        var page = claimService.listForPatient(null, pageable).map(ClaimSummaryDTO::from);
        return ResponseEntity.ok(page);
    }

    // ─── Legacy direct pay (UPI/manual reference) ─────────────────────────
    @PostMapping("/claims/{id}/pay")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ClaimSummaryDTO> payClaim(
            @PathVariable String id,
            @RequestBody(required = false) PaymentRequest request) {
        String method = request != null ? request.getPaymentMethod() : "UPI";
        String ref = request != null ? request.getTransactionRef() : "TXN-" + System.currentTimeMillis();
        var claim = claimService.payClaim(id, method, ref);
        return ResponseEntity.ok(ClaimSummaryDTO.from(claim));
    }


    // ─── Razorpay: Create Order ────────────────────────────────────────────
    /**
     * Step 1: Create a Razorpay payment order for a claim.
     * Frontend uses the returned orderId + keyId to open Razorpay Checkout.
     *
     * POST /api/patient-portal/billing/claims/{id}/razorpay-order
     * Returns: { orderId, amount (paise), currency, keyId, claimId }
     */
    @PostMapping("/claims/{id}/razorpay-order")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> createRazorpayOrder(@PathVariable String id) {
        try {
            Claim claim = claimService.getClaim(id);

            // Server-side amount — never trust frontend-submitted amount
            BigDecimal amount = claim.getPatientResponsibility() != null && claim.getPatientResponsibility().compareTo(BigDecimal.ZERO) > 0
                    ? claim.getPatientResponsibility()
                    : (claim.getTotalCharged() != null ? claim.getTotalCharged() : BigDecimal.ZERO);

            if (amount.compareTo(BigDecimal.ZERO) <= 0) {
                return ResponseEntity.badRequest().body(Map.of("error", "Claim has zero or negative balance"));
            }

            Map<String, Object> orderDetails = razorpayService.createOrder(amount, id);
            // Add patient identifier for Razorpay prefill (Claim model has patientId, not patientName)
            orderDetails.put("patientName", claim.getPatientId() != null ? claim.getPatientId() : "Patient");
            return ResponseEntity.ok(orderDetails);

        } catch (Exception e) {
            log.error("Failed to create Razorpay order for claim {}: {}", id, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ─── Razorpay: Verify Payment & Settle Claim ──────────────────────────
    /**
     * Step 2: Verify Razorpay payment signature after checkout completes.
     * If valid, marks the claim as PAID.
     *
     * POST /api/patient-portal/billing/claims/{id}/razorpay-verify
     * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
     */
    @PostMapping("/claims/{id}/razorpay-verify")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> verifyRazorpayPayment(
            @PathVariable String id,
            @RequestBody RazorpayVerifyRequest body) {

        if (body == null || body.getRazorpayOrderId() == null || body.getRazorpayPaymentId() == null || body.getRazorpaySignature() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing Razorpay payment details"));
        }

        boolean valid = razorpayService.verifyPaymentSignature(
                body.getRazorpayOrderId(),
                body.getRazorpayPaymentId(),
                body.getRazorpaySignature()
        );

        if (!valid) {
            log.warn("🚫 Razorpay payment verification failed for claim {}: orderId={}", id, body.getRazorpayOrderId());
            return ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED)
                    .body(Map.of("error", "Payment verification failed — signature mismatch"));
        }

        try {
            Claim paid = claimService.payClaim(id, "RAZORPAY", body.getRazorpayPaymentId());
            log.info("✅ Claim {} settled to PAID via Razorpay paymentId={}", id, body.getRazorpayPaymentId());
            return ResponseEntity.ok(ClaimSummaryDTO.from(paid));
        } catch (Exception e) {
            log.error("❌ Failed to settle claim {} after Razorpay verification: {}", id, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ─── Inner DTOs ───────────────────────────────────────────────────────

    public static class PaymentRequest {
        private String paymentMethod;
        private String transactionRef;
        public String getPaymentMethod() { return paymentMethod; }
        public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }
        public String getTransactionRef() { return transactionRef; }
        public void setTransactionRef(String transactionRef) { this.transactionRef = transactionRef; }
    }

    public static class RazorpayVerifyRequest {
        private String razorpayOrderId;
        private String razorpayPaymentId;
        private String razorpaySignature;
        public String getRazorpayOrderId() { return razorpayOrderId; }
        public void setRazorpayOrderId(String razorpayOrderId) { this.razorpayOrderId = razorpayOrderId; }
        public String getRazorpayPaymentId() { return razorpayPaymentId; }
        public void setRazorpayPaymentId(String razorpayPaymentId) { this.razorpayPaymentId = razorpayPaymentId; }
        public String getRazorpaySignature() { return razorpaySignature; }
        public void setRazorpaySignature(String razorpaySignature) { this.razorpaySignature = razorpaySignature; }
    }
}
