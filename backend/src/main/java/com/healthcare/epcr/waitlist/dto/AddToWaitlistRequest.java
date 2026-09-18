package com.healthcare.epcr.waitlist.dto;

import com.healthcare.epcr.waitlist.enums.WaitlistPriority;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * Request payload for adding a patient to the waitlist.
 * Follows same pattern as CreatePatientCareRecordRequest.
 */
@Data
public class AddToWaitlistRequest {

    @NotBlank(message = "facilityId is required")
    private String facilityId;

    @NotBlank(message = "serviceType is required")
    private String serviceType;

    @NotBlank(message = "patientId is required")
    private String patientId;

    @NotBlank(message = "patientName is required")
    private String patientName;

    @NotNull(message = "priority is required")
    private WaitlistPriority priority;

    @NotBlank(message = "reasonForVisit is required")
    private String reasonForVisit;

    /** Optional clinical notes */
    private String notes;
}
