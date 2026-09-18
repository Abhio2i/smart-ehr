package com.healthcare.epcr.qa.rule.service;

import com.healthcare.epcr.qa.rule.model.QAAutoFlagRule;
import com.healthcare.epcr.qa.rule.repository.QAAutoFlagRuleRepository;
import com.healthcare.epcr.security.AccessControlService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class QAAutoFlagRuleService {
    private final QAAutoFlagRuleRepository ruleRepository;
    private final AccessControlService accessControlService;

    public QAAutoFlagRule createRule(QAAutoFlagRule rule) {
        accessControlService.assertOrganizationAccess(rule.getOrganizationId());
        if (rule.getActive() == null) rule.setActive(true);
        rule.setCreatedAt(LocalDateTime.now());
        rule.setUpdatedAt(LocalDateTime.now());
        return ruleRepository.save(rule);
    }

    public List<QAAutoFlagRule> getActiveRules(String organizationId) {
        accessControlService.assertOrganizationAccess(organizationId);
        return ruleRepository.findByOrganizationIdAndActiveTrue(organizationId);
    }
}
