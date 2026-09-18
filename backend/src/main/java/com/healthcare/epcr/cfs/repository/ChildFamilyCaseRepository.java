package com.healthcare.epcr.cfs.repository;

import com.healthcare.epcr.cfs.entity.ChildFamilyCase;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChildFamilyCaseRepository extends MongoRepository<ChildFamilyCase, String> {
    Optional<ChildFamilyCase> findByCaseNumber(String caseNumber);
    List<ChildFamilyCase> findByChildPatientId(String childPatientId);
    Page<ChildFamilyCase> findByCaseStatus(String caseStatus, Pageable pageable);
    Page<ChildFamilyCase> findByProtectionRiskLevel(String protectionRiskLevel, Pageable pageable);
    Page<ChildFamilyCase> findByOrganizationId(String organizationId, Pageable pageable);
}
