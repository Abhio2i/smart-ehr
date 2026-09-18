package com.healthcare.epcr.rulesengine.dto;

import lombok.Data;

import java.util.List;

@Data
public class RunRulesRequest {
    private Boolean dryRun = true;
    private String organizationId;
    private List<String> ruleIds;
    private List<String> patientIds;
    private List<String> recordIds;
}

