package com.healthcare.epcr.billing.model;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class ClaimLineItem {
    private String id;
    private String cptOrHcpcsCode;
    private String icd10Code;
    private String description;
    private LineItemSourceType sourceType;
    private int quantity;
    private BigDecimal unitCharge;
    private BigDecimal lineTotal;
    private LocalDateTime serviceDate;
    private String providerId;
}
