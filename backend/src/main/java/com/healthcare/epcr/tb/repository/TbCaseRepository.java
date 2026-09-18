package com.healthcare.epcr.tb.repository;

import com.healthcare.epcr.tb.enums.TbCaseStatus;
import com.healthcare.epcr.tb.model.TbCase;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TbCaseRepository extends MongoRepository<TbCase, String> {
    Page<TbCase> findByOrganizationId(String organizationId, Pageable pageable);
    Page<TbCase> findByOrganizationIdAndStatus(String organizationId, TbCaseStatus status, Pageable pageable);
    Optional<TbCase> findByCaseNumber(String caseNumber);
    java.util.List<TbCase> findByPatientId(String patientId);
    long countByOrganizationIdAndStatus(String organizationId, TbCaseStatus status);
    long countByOrganizationId(String organizationId);
}
