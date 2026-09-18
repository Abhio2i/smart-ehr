package com.healthcare.epcr.qa.rule.repository;

import com.healthcare.epcr.qa.rule.model.QAAutoFlagRule;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface QAAutoFlagRuleRepository extends MongoRepository<QAAutoFlagRule, String> {
    List<QAAutoFlagRule> findByOrganizationIdAndActiveTrue(String organizationId);
}
