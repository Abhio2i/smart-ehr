package com.healthcare.epcr.patienthistory.repository;

import com.healthcare.epcr.patienthistory.model.PatientLabResult;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface PatientLabResultRepository extends MongoRepository<PatientLabResult, String> {
    List<PatientLabResult> findByPatientId(String patientId);
    List<PatientLabResult> findByConditionId(String conditionId);
}
