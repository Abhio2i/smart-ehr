package com.healthcare.epcr.dental.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Tracks a single school-based dental screening/program visit.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "dental_program_visits")
public class DentalProgramVisit {

    @Id
    private String id;

    @Indexed
    private String organizationId;

    private String schoolName;
    private String community;
    private LocalDate visitDate;

    private String conductedBy;       // userId
    private String conductedByName;

    /** Patient IDs screened during this visit — links back to individual DentalChart updates. */
    private List<String> patientIdsScreened;

    private Integer totalStudentsScreened;
    private Integer referralsNeeded;   // count flagged for follow-up treatment

    private String notes;

    @CreatedDate
    private LocalDateTime createdAt;
}
