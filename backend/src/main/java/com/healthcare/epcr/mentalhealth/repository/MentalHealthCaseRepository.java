package com.healthcare.epcr.mentalhealth.repository;

import com.healthcare.epcr.mentalhealth.entity.MentalHealthCase;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MentalHealthCaseRepository extends MongoRepository<MentalHealthCase, String> {
    Page<MentalHealthCase> findByOrganizationId(String organizationId, Pageable pageable);
    Page<MentalHealthCase> findByOrganizationIdAndStatus(String organizationId, MentalHealthCase.CaseStatus status, Pageable pageable);
    Optional<MentalHealthCase> findByPatientIdAndStatusIn(String patientId, List<MentalHealthCase.CaseStatus> statuses);
    List<MentalHealthCase> findByPatientId(String patientId);
}
