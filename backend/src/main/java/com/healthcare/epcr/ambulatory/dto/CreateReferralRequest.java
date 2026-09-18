package com.healthcare.epcr.ambulatory.dto;

import com.healthcare.epcr.ambulatory.entity.AmbulatoryReferral;
import com.healthcare.epcr.ambulatory.entity.AmbulatorySpecialty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * Request body for POST /api/ambulatory/referrals.
 *
 * Follows the same @Data + jakarta validation pattern used by
 * CreateMentalHealthCaseRequest, AddToWaitlistRequest, etc.
 */
@Data
public class CreateReferralRequest {

    @NotBlank(message = "patientId is required")
    private String patientId;

    @NotBlank(message = "patientName is required")
    private String patientName;

    /** The GP / paramedic / physician initiating the referral. */
    @NotBlank(message = "referringProviderId is required")
    private String referringProviderId;

    @NotNull(message = "specialty is required")
    private AmbulatorySpecialty specialty;

    @NotBlank(message = "facilityId is required")
    private String facilityId;

    @NotBlank(message = "reasonForReferral is required")
    private String reasonForReferral;

    @NotNull(message = "urgency is required")
    private AmbulatoryReferral.Urgency urgency;
}
