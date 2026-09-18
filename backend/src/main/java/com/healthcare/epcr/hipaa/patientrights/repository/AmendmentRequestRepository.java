package com.healthcare.epcr.hipaa.patientrights.repository;

import com.healthcare.epcr.hipaa.patientrights.model.AmendmentRequest;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface AmendmentRequestRepository extends MongoRepository<AmendmentRequest, String> {
    List<AmendmentRequest> findByPatientIdOrderByCreatedAtDesc(String patientId);
}

