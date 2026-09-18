package com.healthcare.epcr.patient.repository;

import com.healthcare.epcr.patient.model.Patient;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface PatientRepository extends MongoRepository<Patient, String> {
    Optional<Patient> findByPatientId(String patientId);
    boolean existsByPatientId(String patientId);
    Optional<Patient> findByEmail(String email);
    Optional<Patient> findByPhone(String phone);
    List<Patient> findAllByEmail(String email);
    List<Patient> findAllByPhone(String phone);
    List<Patient> findByPhoneContaining(String phone);
}
