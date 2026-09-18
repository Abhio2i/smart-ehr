package com.healthcare.epcr.qa.rule.controller;

import com.healthcare.epcr.qa.rule.model.QAAutoFlagRule;
import com.healthcare.epcr.qa.rule.service.QAAutoFlagRuleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/qa/rules")
@RequiredArgsConstructor
public class QAAutoFlagRuleController {

    private final QAAutoFlagRuleService ruleService;

    @PostMapping
    public ResponseEntity<QAAutoFlagRule> createRule(@RequestBody QAAutoFlagRule rule) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ruleService.createRule(rule));
    }

    @GetMapping
    public ResponseEntity<List<QAAutoFlagRule>> getRules(@RequestParam String organizationId) {
        return ResponseEntity.ok(ruleService.getActiveRules(organizationId));
    }
}
