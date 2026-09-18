package com.healthcare.epcr.patient.dto;

import lombok.Data;

/**
 * Request body for POST /api/patients/{id}/override-duplicate
 * User must supply a reason when permanently overriding the duplicate warning.
 */
@Data
public class DuplicateOverrideRequest {
    /** The patientId that was flagged as a duplicate but is being overridden. */
    private String flaggedPatientId;
    /** Mandatory justification reason (e.g., "Client is a twin of TB-2026-00001"). */
    private String reason;
}
