package com.healthcare.epcr.patienthistory.repository;

import com.healthcare.epcr.patienthistory.model.PatientAdmission;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface PatientAdmissionRepository extends MongoRepository<PatientAdmission, String> {
    List<PatientAdmission> findByPatientId(String patientId);
    List<PatientAdmission> findByConditionId(String conditionId);
}
