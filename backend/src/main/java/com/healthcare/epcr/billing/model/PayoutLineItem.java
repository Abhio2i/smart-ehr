package com.healthcare.epcr.billing.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PayoutLineItem {
    private String sourceType;   // SHIFT / PROCEDURE
    private String sourceRefId;
    private String description;
    private Double amount;
}
