package com.healthcare.epcr.hipaa.baa.repository;

import com.healthcare.epcr.hipaa.baa.model.BusinessAssociate;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface BusinessAssociateRepository extends MongoRepository<BusinessAssociate, String> {
    List<BusinessAssociate> findByOrganizationIdOrderByCreatedAtDesc(String organizationId);
}

