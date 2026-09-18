package com.healthcare.epcr.hipaa.disclosure.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Document(collection = "disclosure_logs")
public class DisclosureLog {
    @Id
    private String id;
    @Indexed
    private String organizationId;
    @Indexed
    private String patientId;
    private String recordId;
    private String disclosedByUserId;
    private String recipientType;
    private String recipientName;
    private String purpose;
    private List<String> dataElements;
    private String legalBasis;
    private String consentId;
    private LocalDateTime disclosedAt;
    private String method;
    private String requestId;
}

