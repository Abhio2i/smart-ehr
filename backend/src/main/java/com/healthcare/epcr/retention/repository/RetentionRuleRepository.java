package com.healthcare.epcr.retention.repository;

import com.healthcare.epcr.retention.model.RetentionRule;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RetentionRuleRepository extends MongoRepository<RetentionRule, String> {
    List<RetentionRule> findByOrganizationId(String organizationId);
}
