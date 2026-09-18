package com.healthcare.epcr.tb.model;

import com.healthcare.epcr.tb.enums.ContactInvestigationStatus;
import com.healthcare.epcr.tb.enums.ContactRiskLevel;
import com.healthcare.epcr.tb.enums.ExposureType;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;

@Document(collection = "tb_contacts")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TbContact {

    @Id
    private String id;

    /** Link to the source TbCase (index case) */
    @Indexed
    private String indexCaseId;

    @Indexed
    private String organizationId;

    /** Optional: link to registered patient in the system */
    private String contactPatientId;

    // Contact demographics (for unregistered contacts)
    private String contactName;
    private String contactPhone;
    private String contactEmail;
    private String contactAddress;
    private String dateOfBirth;
    private String gender;

    private ContactRiskLevel riskLevel;
    private ExposureType exposureType;
    private LocalDate exposureStartDate;
    private LocalDate exposureEndDate;

    /** Average hours per day the contact was exposed to index case */
    private Integer avgExposureHoursPerDay;

    private ContactInvestigationStatus investigationStatus;
    private LocalDate lastContactDate;

    private String assignedNurseId;
    private String assignedNurseName;
    private String notes;

    private Instant createdAt;
    private Instant updatedAt;
    private String createdBy;
}
