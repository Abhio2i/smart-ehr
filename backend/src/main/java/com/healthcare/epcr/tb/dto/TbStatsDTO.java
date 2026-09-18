package com.healthcare.epcr.tb.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class TbStatsDTO {
    private long totalCases;
    private long activeTreatmentCases;
    private long suspectedCases;
    private long confirmedCases;
    private long completedCases;
    private long totalContacts;
    private long highRiskContacts;
    private long mediumRiskContacts;
    private long pendingEvaluationContacts;
    private long completedContactInvestigations;
}
