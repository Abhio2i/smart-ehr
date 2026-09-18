package com.healthcare.epcr.integration.ontario.model;

import com.healthcare.epcr.integration.ontario.enums.OntarioSyncStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "ontario_sync_logs")
public class OntarioSyncLog {

    @Id
    private String id;

    @Indexed
    private String organizationId;

    private String recordId;
    private String recordType; // TB_CASE, IMMUNIZATION, LAB_REPORT

    @Indexed
    private String targetPlatform; // IPHIS, OLIS, PANORAMA

    private String payloadSent;
    private String payloadReceived;

    private OntarioSyncStatus status;
    private String errorMessage;

    @Indexed
    private Instant timestamp;

    private String triggeredBy;
    private String userDisplayName;
}
