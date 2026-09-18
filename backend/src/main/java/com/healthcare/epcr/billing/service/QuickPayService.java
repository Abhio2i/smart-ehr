package com.healthcare.epcr.billing.service;

import com.healthcare.epcr.billing.model.Claim;
import com.healthcare.epcr.billing.model.ClaimStatus;
import com.healthcare.epcr.billing.model.OrgPaymentGatewayConfig;
import com.healthcare.epcr.billing.model.PayerType;
import com.healthcare.epcr.billing.repository.ClaimRepository;
import com.healthcare.epcr.billing.repository.OrgPaymentGatewayConfigRepository;
import com.healthcare.epcr.billing.security.TenantContext;
import com.healthcare.epcr.notification.service.EmailService;
import com.razorpay.PaymentLink;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class QuickPayService {

    private final ClaimRepository claimRepository;
    private final OrgPaymentGatewayConfigRepository orgGatewayRepo;
    private final EmailService emailService;

    @Value("${app.frontend.base-url:http://localhost:5173}")
    private String frontendBaseUrl;

    /**
     * Create a Quick Pay link or fallback UPI QR + bind to claim.
     */
    public Map<String, Object> createQuickPay(
            String patientName,
            String patientEmail,
            String patientPhone,
            BigDecimal amount,
            String description,
            String doctorUserId,
            String doctorName,
            String existingClaimId) {

        String orgId = TenantContext.currentOrganizationId();
        if (orgId == null || orgId.isBlank()) {
            throw new IllegalStateException("Organization context is missing.");
        }

        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Amount must be greater than zero.");
        }

        String safeName = (patientName != null && !patientName.isBlank()) ? patientName : "Patient";
        String safeDesc = (description != null && !description.isBlank()) ? description : "Medical Bill Payment";

        // Step 1: Reuse existing claim or auto-create a claim in SUBMITTED status
        Claim claim = null;
        if (existingClaimId != null && !existingClaimId.isBlank()) {
            claim = claimRepository.findById(existingClaimId)
                    .orElseGet(() -> claimRepository.findByOrganizationIdAndClaimNumber(orgId, existingClaimId)
                    .orElseGet(() -> claimRepository.findByClaimNumber(existingClaimId).orElse(null)));
        }

        if (claim == null) {
            claim = new Claim();
            claim.setOrganizationId(orgId);
            claim.setPatientId(safeName);
            claim.setPatientName(safeName);
            claim.setPayerId("SELF_PAY");
            claim.setPayerType(PayerType.SELF_PAY);
            claim.setDoctorUserId(doctorUserId);
            claim.setDoctorName(doctorName);
            claim.setClaimNumber("QP-" + System.currentTimeMillis());
            claim.setStatus(ClaimStatus.SUBMITTED);
            claim.setTotalCharged(amount);
            claim.setPatientResponsibility(amount);
            claim.setNotes(safeDesc);
            claim.setCreatedAt(LocalDateTime.now());
            claim.setUpdatedAt(LocalDateTime.now());
            claim = claimRepository.save(claim);
        } else {
            claim.setStatus(ClaimStatus.SUBMITTED);
            claim.setUpdatedAt(LocalDateTime.now());
            claim = claimRepository.save(claim);
        }

        log.info("[QuickPay] Claim {} initialized for ₹{} | Patient: {} | Org: {}",
                claim.getClaimNumber(), amount, safeName, orgId);

        // Step 2: Check Org Razorpay keys; if present, use Razorpay Payment Link
        OrgPaymentGatewayConfig config = orgGatewayRepo
                .findByOrganizationIdAndActiveTrue(orgId)
                .orElse(null);

        boolean hasRazorpayKeys = config != null &&
                config.getKeyId() != null && !config.getKeyId().isBlank() &&
                !config.getKeyId().contains("xxxx") && !config.getKeyId().contains("XXXX") &&
                config.getKeySecret() != null && !config.getKeySecret().isBlank();

        if (!hasRazorpayKeys) {
            log.warn("[QuickPay] Payment Gateway NOT configured for org {} — returning validation warning", orgId);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("success", false);
            result.put("gatewayConfigured", false);
            result.put("claimId", claim.getId());
            result.put("claimNumber", claim.getClaimNumber());
            result.put("patientName", safeName);
            result.put("amount", amount.doubleValue());
            result.put("message", "Payment Gateway is not configured for your hospital. Please configure Payment Gateway in Settings → Provider Payments.");
            return result;
        }

        try {
            RazorpayClient client = new RazorpayClient(config.getKeyId(), config.getKeySecret());

            long amountInPaise = amount.multiply(BigDecimal.valueOf(100)).longValue();

            JSONObject linkRequest = new JSONObject();
            linkRequest.put("amount", amountInPaise);
            linkRequest.put("currency", "INR");
            linkRequest.put("description", safeDesc);

            JSONObject customer = new JSONObject();
            customer.put("name", safeName);
            if (patientEmail != null && !patientEmail.isBlank()) customer.put("email", patientEmail);
            if (patientPhone != null && !patientPhone.isBlank()) customer.put("contact", patientPhone);
            linkRequest.put("customer", customer);

            JSONObject notify = new JSONObject();
            notify.put("email", patientEmail != null && !patientEmail.isBlank());
            notify.put("sms", patientPhone != null && !patientPhone.isBlank());
            linkRequest.put("notify", notify);

            linkRequest.put("callback_url", frontendBaseUrl + "/patient-portal/payment-success");
            linkRequest.put("callback_method", "get");

            long expireBy = (System.currentTimeMillis() / 1000) + (24 * 60 * 60);
            linkRequest.put("expire_by", expireBy);

            JSONObject notes = new JSONObject();
            notes.put("claimId", claim.getId());
            notes.put("claimNumber", claim.getClaimNumber());
            notes.put("organizationId", orgId);
            notes.put("quickPay", "true");
            if (doctorUserId != null) notes.put("doctorUserId", doctorUserId);
            if (doctorName != null) notes.put("doctorName", doctorName);
            linkRequest.put("notes", notes);

            PaymentLink link = client.paymentLink.create(linkRequest);

            String shortUrl = link.get("short_url");
            String linkId = link.get("id");

            if (patientEmail != null && !patientEmail.isBlank()) {
                sendQuickPayEmail(patientEmail, safeName, amount, safeDesc, shortUrl, claim.getClaimNumber(), doctorName);
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("success", true);
            result.put("gatewayConfigured", true);
            result.put("paymentLinkId", linkId);
            result.put("shortUrl", shortUrl);
            result.put("qrData", shortUrl);
            result.put("amount", amount.doubleValue());
            result.put("claimId", claim.getId());
            result.put("claimNumber", claim.getClaimNumber());
            result.put("patientName", safeName);
            result.put("mode", "RAZORPAY");
            result.put("expiresIn", "24 hours");
            result.put("message", "Payment link generated via Razorpay.");
            return result;

        } catch (RazorpayException e) {
            log.error("[QuickPay] Razorpay link creation failed: {}", e.getMessage());
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("success", false);
            result.put("gatewayConfigured", true);
            result.put("claimId", claim.getId());
            result.put("claimNumber", claim.getClaimNumber());
            result.put("patientName", safeName);
            result.put("amount", amount.doubleValue());
            result.put("message", "Razorpay Payment Link failed: " + e.getMessage() + ". Please verify API keys in Provider Payments.");
            return result;
        }
    }

    private void sendQuickPayEmail(String email, String patientName, BigDecimal amount,
                                    String description, String payUrl,
                                    String claimNumber, String doctorName) {
        try {
            String safeDoctor = (doctorName != null && !doctorName.isBlank()) ? doctorName : "Your Healthcare Provider";
            String subject = "💳 Pay Your Medical Bill — ₹" + String.format("%.2f", amount) + " | #" + claimNumber;

            String body = "<div style='font-family: Arial, sans-serif; padding: 28px; color: #1f2937; max-width: 550px; border: 1px solid #e2e8f0; border-radius: 16px; background: #ffffff;'>" +
                    "<div style='border-bottom: 2px solid #1a3c8f; padding-bottom: 16px; margin-bottom: 20px;'>" +
                    "<h2 style='color: #1a3c8f; margin: 0; font-size: 20px;'>Smart-eHR Medical Portal</h2>" +
                    "<p style='margin: 4px 0 0 0; color: #64748b; font-size: 12px;'>Secure Online Bill Payment</p>" +
                    "</div>" +
                    "<p style='font-size: 15px;'>Dear <strong>" + patientName + "</strong>,</p>" +
                    "<p style='font-size: 14px; color: #334155;'>" + safeDoctor + " has generated a medical bill for your recent visit.</p>" +
                    "<div style='background: linear-gradient(135deg, #f0f4ff, #e8ecf8); padding: 20px; border-radius: 12px; border-left: 5px solid #1a3c8f; margin: 20px 0; text-align: center;'>" +
                    "<p style='margin: 0; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1px;'>Amount Due</p>" +
                    "<p style='margin: 6px 0 0 0; font-size: 32px; font-weight: 900; color: #0f172a;'>₹" + String.format("%.2f", amount) + "</p>" +
                    "<p style='margin: 8px 0 0 0; font-size: 13px; color: #475569;'>" + description + "</p>" +
                    "<p style='margin: 4px 0 0 0; font-size: 12px; color: #94a3b8;'>Bill #" + claimNumber + "</p>" +
                    "</div>" +
                    "<div style='text-align: center; margin: 24px 0;'>" +
                    "<a href='" + payUrl + "' style='background: linear-gradient(135deg, #1a3c8f, #2563eb); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 15px rgba(26,60,143,0.3);'>💳 Pay Now Securely</a>" +
                    "</div>" +
                    "<p style='font-size: 12px; color: #94a3b8; text-align: center;'>Powered by Smart-eHR Billing Engine.</p>" +
                    "</div>";

            emailService.sendEmail(email, subject, body);
            log.info("[QuickPay] 📧 Payment email sent to {} for bill #{}", email, claimNumber);
        } catch (Exception ex) {
            log.warn("[QuickPay] Email dispatch failed for {}: {}", email, ex.getMessage());
        }
    }
}
