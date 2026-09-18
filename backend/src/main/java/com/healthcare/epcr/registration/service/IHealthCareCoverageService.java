package com.healthcare.epcr.registration.service;

import com.healthcare.epcr.registration.dto.CreateOrUpdateCoverageRequest;
import com.healthcare.epcr.registration.dto.HealthCareCoverageDTO;

public interface IHealthCareCoverageService {
    HealthCareCoverageDTO getCoverageByPatientId(String patientId);
    HealthCareCoverageDTO createOrUpdateCoverage(String patientId, CreateOrUpdateCoverageRequest request);
    HealthCareCoverageDTO getActiveEligibility(String patientId);
    HealthCareCoverageDTO verifyCoverage(String patientId);
    void deleteCoverage(String patientId);
}
