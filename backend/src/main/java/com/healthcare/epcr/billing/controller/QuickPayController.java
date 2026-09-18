package com.healthcare.epcr.billing.controller;

import com.healthcare.epcr.billing.service.QuickPayService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

/**
 * QuickPayController — One-tap payment link + QR for instant patient billing.
 *
 * POST /api/billing/quick-pay
 *   Body: { patientName, patientEmail, patientPhone, amount, description, doctorUserId, doctorName }
 *   Returns: { shortUrl, qrData, claimNumber, paymentLinkId, ... }
 */
@RestController
@RequestMapping("/api/billing/quick-pay")
@RequiredArgsConstructor
@Slf4j
public class QuickPayController {

    private final QuickPayService quickPayService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN','PARAMEDIC')")
    public ResponseEntity<?> createQuickPay(@RequestBody QuickPayRequest request) {
        try {
            if (request.getPatientName() == null || request.getPatientName().isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Patient name is required"));
            }
            if (request.getAmount() == null || request.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
                return ResponseEntity.badRequest().body(Map.of("error", "Amount must be greater than zero"));
            }

            Map<String, Object> result = quickPayService.createQuickPay(
                    request.getPatientName(),
                    request.getPatientEmail(),
                    request.getPatientPhone(),
                    request.getAmount(),
                    request.getDescription(),
                    request.getDoctorUserId(),
                    request.getDoctorName(),
                    request.getClaimId()
            );

            return ResponseEntity.ok(result);

        } catch (IllegalStateException e) {
            log.warn("[QuickPay] Config error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("[QuickPay] Error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", e.getMessage() != null ? e.getMessage() : "Payment link generation failed"));
        }
    }

    @Data
    public static class QuickPayRequest {
        private String claimId;
        private String patientName;
        private String patientEmail;
        private String patientPhone;
        private BigDecimal amount;
        private String description;
        private String doctorUserId;
        private String doctorName;
    }
}
