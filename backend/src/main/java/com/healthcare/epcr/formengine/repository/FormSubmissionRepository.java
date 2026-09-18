package com.healthcare.epcr.formengine.repository;

import com.healthcare.epcr.formengine.model.FormSubmission;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface FormSubmissionRepository extends MongoRepository<FormSubmission, String> {
    List<FormSubmission> findByOrganizationId(String organizationId);
    List<FormSubmission> findByTemplateId(String templateId);
}
