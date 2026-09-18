package com.healthcare.epcr.billing.repository;

import com.healthcare.epcr.billing.model.Claim;
import com.healthcare.epcr.billing.model.ClaimStatus;
import com.healthcare.epcr.billing.model.PayerType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface ClaimRepository extends MongoRepository<Claim, String> {

    // ALWAYS require organizationId in the query — never findById() alone in service code
    Optional<Claim> findByIdAndOrganizationId(String id, String organizationId);

    // Alias with reversed parameter order — used by deleteClaim org-scoped guard
    Optional<Claim> findByOrganizationIdAndId(String organizationId, String id);

    Page<Claim> findByOrganizationIdAndStatus(String organizationId, ClaimStatus status, Pageable pageable);

    Page<Claim> findByStatus(ClaimStatus status, Pageable pageable);

    long countByStatus(ClaimStatus status);

    Page<Claim> findByOrganizationIdAndPatientId(String organizationId, String patientId, Pageable pageable);

    Page<Claim> findByOrganizationIdAndPayerType(String organizationId, PayerType payerType, Pageable pageable);

    Page<Claim> findByOrganizationId(String organizationId, Pageable pageable);

    Optional<Claim> findByOrganizationIdAndIdempotencyKey(String organizationId, String idempotencyKey);

    Optional<Claim> findByOrganizationIdAndClaimNumber(String organizationId, String claimNumber);

    Optional<Claim> findByClaimNumber(String claimNumber);

    Optional<Claim> findByOrganizationIdAndEpcrRecordId(String organizationId, String epcrRecordId);

    long countByOrganizationIdAndStatus(String organizationId, ClaimStatus status);
}
