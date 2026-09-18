package com.healthcare.epcr.tb.dto;

import lombok.Data;
import java.time.LocalDate;

@Data
public class AddTstTestRequest {
    private String testType;          // "TST" | "IGRA"
    private LocalDate plantDate;
    private String plantedBy;
    private String plantArm;
    private String plantBatchNumber;
    private LocalDate readDate;
    private String readBy;
    private Integer indurationMm;
    private String result;            // POSITIVE | NEGATIVE | INDETERMINATE | PENDING_READ
    private String clinicianInterpretation;
    private LocalDate chestXrayDate;
    private String chestXrayResult;
    private String chestXrayFindings;
    private String notes;
}
