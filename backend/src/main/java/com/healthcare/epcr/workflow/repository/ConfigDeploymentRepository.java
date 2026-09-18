package com.healthcare.epcr.workflow.repository;

import com.healthcare.epcr.workflow.model.ConfigDeployment;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ConfigDeploymentRepository extends MongoRepository<ConfigDeployment, String> {
    List<ConfigDeployment> findBySourceOrganizationId(String sourceOrganizationId);
}
