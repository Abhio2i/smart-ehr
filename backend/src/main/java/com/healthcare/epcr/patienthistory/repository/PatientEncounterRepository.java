package com.healthcare.epcr.patienthistory.repository;

import com.healthcare.epcr.patienthistory.model.PatientEncounter;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface PatientEncounterRepository extends MongoRepository<PatientEncounter, String> {
    List<PatientEncounter> findByPatientId(String patientId);
    List<PatientEncounter> findByConditionId(String conditionId);
    Optional<PatientEncounter> findByPatientIdAndEpcrRecordId(String patientId, String epcrRecordId);
}
