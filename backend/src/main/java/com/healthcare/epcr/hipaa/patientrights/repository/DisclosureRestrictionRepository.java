package com.healthcare.epcr.hipaa.patientrights.repository;

import com.healthcare.epcr.hipaa.patientrights.model.DisclosureRestriction;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface DisclosureRestrictionRepository extends MongoRepository<DisclosureRestriction, String> {
    List<DisclosureRestriction> findByPatientIdOrderByCreatedAtDesc(String patientId);
}

