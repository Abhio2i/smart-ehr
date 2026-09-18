package com.healthcare.epcr.billing.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "billing_diagnostic_codes")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DiagnosticCode {

    @Id
    private String id;

    @Indexed(unique = true)
    private String code;              // e.g. "R07.9"

    private String description;       // e.g. "Chest Pain, Unspecified"
}
