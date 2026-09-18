package com.healthcare.epcr.retention.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "retention_rules")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RetentionRule {

    @Id
    private String id;

    @Indexed
    private String organizationId;

    private String policyName;
    private Integer retentionPeriodYears;

    /** Action after expiration: e.g. "ARCHIVE", "DELETE", "REVIEW" */
    private String actionAfterPeriod;

    private String description;
    private Instant createdAt;
    private String createdBy;
}
