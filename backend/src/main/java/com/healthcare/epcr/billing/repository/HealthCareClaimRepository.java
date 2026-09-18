package com.healthcare.epcr.billing.repository;

import com.healthcare.epcr.billing.model.HealthCareClaim;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface HealthCareClaimRepository extends MongoRepository<HealthCareClaim, String> {

    Optional<HealthCareClaim> findByPatientCareRecordId(String patientCareRecordId);

    List<HealthCareClaim> findByOrganizationIdAndStatus(String organizationId, String status);

    Page<HealthCareClaim> findByOrganizationId(String organizationId, Pageable pageable);

    List<HealthCareClaim> findByIdIn(List<String> ids);

    Optional<HealthCareClaim> findByClaimNumber(String claimNumber);

    long countByOrganizationIdAndStatus(String organizationId, String status);

    long countByStatus(String status);

    // Org-scoped batch lookup — prevents cross-tenant IDOR in generateSubmissionBatch
    List<HealthCareClaim> findByIdInAndOrganizationId(List<String> ids, String organizationId);

    // Org-scoped batch-XML lookup — prevents cross-tenant access via batchId
    List<HealthCareClaim> findByBatchIdAndOrganizationId(String batchId, String organizationId);

    // Org-scoped single lookup (used by voidClaim to prevent cross-tenant deletes)
    Optional<HealthCareClaim> findByIdAndOrganizationId(String id, String organizationId);

    Optional<HealthCareClaim> findByOrganizationIdAndClaimNumber(String organizationId, String claimNumber);
}
