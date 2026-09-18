package com.healthcare.epcr.billing.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A single billable line item inside a HealthCareClaim.
 * Embedded document - not a separate Mongo collection.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ClaimItem {

    private String serviceCode;    // Links back to BillingServiceCode.code
    private String description;
    private Integer quantity;
    private Double unitPrice;
    private Double total;          // quantity * unitPrice, computed at creation time
}
