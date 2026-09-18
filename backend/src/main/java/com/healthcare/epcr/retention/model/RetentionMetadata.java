package com.healthcare.epcr.retention.model;

import com.healthcare.epcr.retention.enums.RetentionStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RetentionMetadata {

    private String retentionRuleId;
    private LocalDate calculatedExpiryDate;

    @Builder.Default
    private RetentionStatus status = RetentionStatus.ACTIVE;

    @Builder.Default
    private boolean retentionHold = false;

    private String holdReason;
    private String folderId;
}
