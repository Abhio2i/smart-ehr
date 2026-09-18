package com.healthcare.epcr.tb.model;

import com.healthcare.epcr.tb.enums.TbCaseStatus;
import com.healthcare.epcr.tb.enums.TbClassification;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Document(collection = "tb_cases")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TbCase {

    @Id
    private String id;

    /** Human-readable unique case number e.g. TB-2026-00001 */
    @Indexed(unique = true)
    private String caseNumber;

    @Indexed
    private String organizationId;

    /** Link to existing Patient record in the system */
    @Indexed
    private String patientId;

    private String patientName;
    private String patientDob;
    private String patientPhone;
    private String patientAddress;

    private TbCaseStatus status;
    private TbClassification classification;

    /** Anatomical site of TB (e.g., Lung, Lymph Node, Spine, CNS) */
    private String tbSite;

    private LocalDate symptomStartDate;
    private LocalDate diagnosisDate;

    /** Date case was officially notified to PHO / Public Health Ontario */
    private LocalDate notificationDate;
    private LocalDate treatmentStartDate;
    private LocalDate treatmentEndDate;

    /** Risk factors: e.g. HOMELESSNESS, HIV, DIABETES, CONGREGATE_LIVING, TRAVEL */
    private List<String> riskFactors;

    private String assignedNurseId;
    private String assignedNurseName;
    private String facilityId;

    // Sputum clearance tracking (mandated 3 consecutive negative tests)
    private String sputumSample1Result; // POSITIVE, NEGATIVE, PENDING
    private LocalDate sputumSample1Date;
    private String sputumSample2Result;
    private LocalDate sputumSample2Date;
    private String sputumSample3Result;
    private LocalDate sputumSample3Date;

    private String notes;
    private Instant createdAt;
    private Instant updatedAt;
    private String createdBy;

    private com.healthcare.epcr.retention.model.RetentionMetadata retentionMetadata;
}
