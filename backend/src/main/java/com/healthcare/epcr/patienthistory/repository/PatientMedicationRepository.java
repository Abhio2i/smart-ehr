package com.healthcare.epcr.patienthistory.repository;

import com.healthcare.epcr.patienthistory.model.PatientMedication;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface PatientMedicationRepository extends MongoRepository<PatientMedication, String> {
    List<PatientMedication> findByPatientId(String patientId);
    List<PatientMedication> findByConditionId(String conditionId);
    List<PatientMedication> findByLinkedEpcrId(String linkedEpcrId);
}
