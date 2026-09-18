package com.healthcare.epcr.qa.repository;

import com.healthcare.epcr.qa.model.QAForm;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface QAFormRepository extends MongoRepository<QAForm, String> {
    List<QAForm> findByOrganizationId(String organizationId);
    List<QAForm> findByActive(Boolean active);
}


