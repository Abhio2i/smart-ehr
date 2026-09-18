package com.healthcare.epcr.hipaa.consent.repository;

import com.healthcare.epcr.hipaa.consent.model.PatientConsent;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface PatientConsentRepository extends MongoRepository<PatientConsent, String> {
    List<PatientConsent> findByPatientIdOrderByCreatedAtDesc(String patientId);
    List<PatientConsent> findByOrganizationIdOrderByCreatedAtDesc(String organizationId);
    List<PatientConsent> findByPatientIdAndStatusOrderByCreatedAtDesc(String patientId, String status);
    Optional<PatientConsent> findByIdAndPatientId(String id, String patientId);
}
