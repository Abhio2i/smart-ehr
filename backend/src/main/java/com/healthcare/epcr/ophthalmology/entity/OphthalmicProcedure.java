package com.healthcare.epcr.ophthalmology.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * Lightweight linking record between an Ophthalmology patient and an
 * existing SurgicalCase (cataract surgery, strabismus correction, lid
 * procedures). Tags a surgical case with an ophthalmic procedure category
 * so it shows up correctly in Ophthalmology domain reporting.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "ophthalmic_procedure_links")
public class OphthalmicProcedure {

    @Id
    private String id;

    private String surgicalCaseId;   // FK -> existing surgical_cases collection
    private String patientId;
    private String organizationId;

    private ProcedureCategory category;
    private String eyeSide;          // OD / OS / BOTH

    private String notes;

    @CreatedDate
    private LocalDateTime createdAt;

    public enum ProcedureCategory {
        CATARACT_SURGERY,
        STRABISMUS_CORRECTION,
        LID_PROCEDURE,
        OTHER_MINOR_PROCEDURE
    }
}
