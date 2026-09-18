package com.healthcare.epcr.rulesengine.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RunRulesResponse {
    private boolean dryRun;
    private int evaluatedRecords;
    private int evaluatedRules;
    private int matchedRules;
    private List<RuleMatchResult> matches = new ArrayList<>();
}

