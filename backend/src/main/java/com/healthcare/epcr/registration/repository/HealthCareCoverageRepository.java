package com.healthcare.epcr.registration.repository;

import com.healthcare.epcr.registration.model.HealthCareCoverage;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface HealthCareCoverageRepository extends MongoRepository<HealthCareCoverage, String> {
    Optional<HealthCareCoverage> findByPatientId(String patientId);
    Optional<HealthCareCoverage> findByPatientIdAndOrganizationId(String patientId, String organizationId);
    boolean existsByPatientId(String patientId);
    void deleteByPatientId(String patientId);
}
