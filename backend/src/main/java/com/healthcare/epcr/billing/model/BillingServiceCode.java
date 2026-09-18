package com.healthcare.epcr.billing.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * Master list of payable procedures/services and their dollar rates.
 * Pre-populate this collection with standard NWT ambulance/clinic/supply codes
 * before the claims engine can auto-generate HealthCareClaim items.
 */
@Document(collection = "billing_service_codes")
@Data
public class BillingServiceCode {

    @Id
    private String id;

    @Indexed(unique = true)
    private String code;              // e.g. "AMB-01" (Standard ground ambulance transport)

    private String description;       // Human readable description
    private Double rate;               // Base dollar cost of the service
    private String category;           // AMBULANCE, CLINIC, SUPPLY, DENTAL, etc.
    private Boolean active = true;

    // Optional: lets the matcher find this code from an ePCR incidentType/procedure name
    private String matchKeyword;       // e.g. "transport", "chest pain consult"
}
