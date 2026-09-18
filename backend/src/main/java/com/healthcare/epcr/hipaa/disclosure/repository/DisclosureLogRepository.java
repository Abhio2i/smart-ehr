package com.healthcare.epcr.hipaa.disclosure.repository;

import com.healthcare.epcr.hipaa.disclosure.model.DisclosureLog;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface DisclosureLogRepository extends MongoRepository<DisclosureLog, String> {
    List<DisclosureLog> findByPatientIdOrderByDisclosedAtDesc(String patientId);
    List<DisclosureLog> findByOrganizationIdOrderByDisclosedAtDesc(String organizationId);
}

