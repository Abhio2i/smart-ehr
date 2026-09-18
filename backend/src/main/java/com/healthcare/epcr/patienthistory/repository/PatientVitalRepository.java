package com.healthcare.epcr.patienthistory.repository;

import com.healthcare.epcr.patienthistory.model.PatientVital;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface PatientVitalRepository extends MongoRepository<PatientVital, String> {
    List<PatientVital> findByPatientIdOrderByRecordedAtDesc(String patientId);
    List<PatientVital> findByPatientIdAndRecordedAtBetweenOrderByRecordedAtDesc(String patientId,
                                                                                 LocalDateTime start,
                                                                                 LocalDateTime end);
    List<PatientVital> findByLinkedEpcrId(String linkedEpcrId);
    Optional<PatientVital> findFirstByPatientIdOrderByRecordedAtDesc(String patientId);
}
