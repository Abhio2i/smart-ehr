package com.healthcare.epcr.workflow.repository;

import com.healthcare.epcr.workflow.model.Workflow;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface WorkflowRepository extends MongoRepository<Workflow, String> {
    List<Workflow> findByOrganizationId(String organizationId);
    List<Workflow> findByActive(Boolean active);
}


