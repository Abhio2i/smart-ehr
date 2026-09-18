package com.healthcare.epcr.patienthistory.repository;

import com.healthcare.epcr.patienthistory.model.PatientCondition;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface PatientConditionRepository extends MongoRepository<PatientCondition, String> {
    List<PatientCondition> findByPatientId(String patientId);
    List<PatientCondition> findByLinkedEpcrId(String linkedEpcrId);
}
