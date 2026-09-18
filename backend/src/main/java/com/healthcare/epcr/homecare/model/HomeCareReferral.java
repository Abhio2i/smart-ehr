package com.healthcare.epcr.homecare.model;

import com.healthcare.epcr.homecare.enums.ReferralStatus;
import com.healthcare.epcr.homecare.enums.ServiceType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;

/**
 * HomeCareReferral — physician/doctor creates this to initiate recurring home care.
 * e.g. "Wound dressing change 3x/week for 4 weeks, patient in Fort Liard community."
 */
@Document(collection = "homeCareReferrals")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HomeCareReferral {

    @Id
    private String id;

    @Indexed
    private String patientId;

    private String patientName;

    @Indexed
    private String organizationId;

    private String referringPhysicianId;

    /** WOUND_CARE, IV_THERAPY, PERSONAL_CARE, PALLIATIVE, POST_SURGICAL, etc. */
    private ServiceType serviceType;

    /**
     * Human-readable frequency string.
     * Supported formats: "daily", "3x/week", "every 48 hours", "weekly", "twice daily"
     */
    private String frequency;

    private LocalDate startDate;
    private LocalDate endDate;

    /** Clinical instructions for the visiting nurse. */
    private String careInstructions;

    /** Community/geographic zone for routing — e.g. "Fort Liard", "Yellowknife". */
    @Indexed
    private String homeCommunity;

    /** PENDING → SCHEDULED → ACTIVE → COMPLETED / CANCELLED */
    private ReferralStatus status;

    /** Priority level: HIGH, MEDIUM, LOW */
    private String priority;

    /** Any special equipment or supplies needed. */
    private String specialRequirements;

    private Instant createdAt;
    private Instant updatedAt;
}
