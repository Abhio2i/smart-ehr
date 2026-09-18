package com.healthcare.epcr.formengine.repository;

import com.healthcare.epcr.formengine.model.FormTemplate;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface FormTemplateRepository extends MongoRepository<FormTemplate, String> {
    List<FormTemplate> findByOrganizationIdAndTemplateType(String organizationId, String templateType);
    Optional<FormTemplate> findFirstByOrganizationIdAndTemplateTypeAndPublishedTrueAndActiveTrueOrderByVersionDesc(
            String organizationId, String templateType
    );
}
