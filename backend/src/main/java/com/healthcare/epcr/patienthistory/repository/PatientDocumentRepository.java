package com.healthcare.epcr.patienthistory.repository;

import com.healthcare.epcr.patienthistory.model.PatientDocument;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface PatientDocumentRepository extends MongoRepository<PatientDocument, String> {
    List<PatientDocument> findByPatientId(String patientId);
    List<PatientDocument> findByConditionId(String conditionId);
    List<PatientDocument> findByEncounterId(String encounterId);
}
