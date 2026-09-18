package com.healthcare.epcr.rulesengine.repository;

import com.healthcare.epcr.rulesengine.model.IfThenRule;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface IfThenRuleRepository extends MongoRepository<IfThenRule, String> {
    List<IfThenRule> findByOrganizationIdOrderByCreatedAtDesc(String organizationId);
    List<IfThenRule> findByOrganizationIdAndActiveTrue(String organizationId);
}

