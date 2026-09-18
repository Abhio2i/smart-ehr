package com.healthcare.epcr.rulesengine.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RuleMatchResult {
    private String ruleId;
    private String ruleName;
    private String recordId;
    private String patientId;
    private String patientName;
    private String field;
    private Object value;
    private String operator;
    private String threshold;
    private String actionType;
    private boolean actionExecuted;
    private String status;
}

