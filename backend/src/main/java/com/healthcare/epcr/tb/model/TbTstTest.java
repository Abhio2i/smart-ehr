package com.healthcare.epcr.tb.model;

import com.healthcare.epcr.tb.enums.TstResult;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;

@Document(collection = "tb_tst_tests")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TbTstTest {

    @Id
    private String id;

    @Indexed
    private String contactId;

    /** Optionally linked directly to a case (for index case's own tests) */
    private String caseId;

    @Indexed
    private String organizationId;

    /** TST = Tuberculin Skin Test | IGRA = Blood-based Interferon Gamma Release Assay */
    private String testType;  // "TST" | "IGRA"

    // ── TST Plant Details ────────────────────────────────────────────────────
    private LocalDate plantDate;
    private String plantedBy;       // Nurse name or ID
    private String plantArm;        // "LEFT" | "RIGHT"
    private String plantBatchNumber;

    // ── TST Read Details ─────────────────────────────────────────────────────
    private LocalDate readDate;
    private String readBy;
    private Integer indurationMm;   // Millimetres of induration (bump size)
    private TstResult result;
    private String clinicianInterpretation;

    // ── Follow-up Chest X-Ray (if TST positive) ──────────────────────────────
    private LocalDate chestXrayDate;
    /** NORMAL | ABNORMAL | SUSPECTED_ACTIVE_TB */
    private String chestXrayResult;
    private String chestXrayFindings;

    private String notes;
    private Instant createdAt;
    private Instant updatedAt;
    private String createdBy;
}
