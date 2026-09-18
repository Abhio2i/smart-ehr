package com.healthcare.epcr.hipaa.baa.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Document(collection = "business_associates")
public class BusinessAssociate {
    @Id
    private String id;
    @Indexed
    private String organizationId;
    private String vendorName;
    private String serviceType;
    private String baaStatus; // ACTIVE, SUSPENDED, EXPIRED, PENDING
    private LocalDateTime effectiveFrom;
    private LocalDateTime effectiveTo;
    private String documentRef;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

