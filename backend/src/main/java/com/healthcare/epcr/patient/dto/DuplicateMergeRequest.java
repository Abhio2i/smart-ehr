package com.healthcare.epcr.patient.dto;

import lombok.Data;

/**
 * Request body for POST /api/patients/merge
 * Consolidates secondaryPatientId records into primaryPatientId.
 */
@Data
public class DuplicateMergeRequest {
    /** Target patient record ID to KEEP and consolidate data into. */
    private String primaryPatientId;

    /** Secondary duplicate patient record ID to merge FROM (will be deactivated/merged). */
    private String secondaryPatientId;

    /** Mandatory reason or justification for the merge operation. */
    private String reason;
}
