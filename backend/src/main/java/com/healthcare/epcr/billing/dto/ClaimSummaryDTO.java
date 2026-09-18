package com.healthcare.epcr.billing.dto;

import com.healthcare.epcr.billing.model.Claim;
import com.healthcare.epcr.billing.model.ClaimStatus;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

// Patient-facing view — never expose payer negotiated rates, internal codes, or provider notes
@Data
public class ClaimSummaryDTO {
    private String id;
    private String claimNumber;
    private ClaimStatus status;
    private BigDecimal patientResponsibility;
    private BigDecimal totalAmount;
    private LocalDateTime submittedAt;
    private LocalDateTime updatedAt;

    public static ClaimSummaryDTO from(Claim claim) {
        ClaimSummaryDTO dto = new ClaimSummaryDTO();
        dto.setId(claim.getId());
        dto.setClaimNumber(claim.getClaimNumber());
        dto.setStatus(claim.getStatus());
        BigDecimal amt = BigDecimal.ZERO;
        if (claim.getPatientResponsibility() != null && claim.getPatientResponsibility().compareTo(BigDecimal.ZERO) > 0) {
            amt = claim.getPatientResponsibility();
        } else if (claim.getTotalCharged() != null && claim.getTotalCharged().compareTo(BigDecimal.ZERO) > 0) {
            amt = claim.getTotalCharged();
        } else if (claim.getLineItems() != null && !claim.getLineItems().isEmpty()) {
            amt = claim.getLineItems().stream()
                    .map(item -> item.getLineTotal() != null ? item.getLineTotal() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
        }
        dto.setPatientResponsibility(amt);
        dto.setTotalAmount(amt);
        dto.setSubmittedAt(claim.getSubmittedAt());
        dto.setUpdatedAt(claim.getUpdatedAt());
        return dto;
    }
}
