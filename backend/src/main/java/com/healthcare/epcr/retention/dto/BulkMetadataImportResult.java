package com.healthcare.epcr.retention.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BulkMetadataImportResult {
    private int totalProcessed;
    private int successCount;
    private int failureCount;
    private List<String> importedPolicyNames;
    private List<String> errors;
}
