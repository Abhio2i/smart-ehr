package com.healthcare.epcr.billing.dto;

import com.healthcare.epcr.billing.model.PayerType;
import lombok.Data;

import java.util.List;

@Data
public class CreateClaimRequest {
    private String patientId;
    private String patientName;
    private String doctorUserId;
    private String doctorName;
    private String epcrRecordId;
    private PayerType payerType;
    private String payerId;
    private String payerDetails;
    private String icdCode;
    private String facilityCode;
    private String providerBillingNumber;
    private List<LineItemRequest> items;

    @Data
    public static class LineItemRequest {
        private String sourceType;
        private String serviceCode;
        private String description;
        private int quantity;
        private double unitPrice;
        private double total;
    }
}
