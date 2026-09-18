package com.healthcare.epcr.billing.repository;

import com.healthcare.epcr.billing.model.DoctorPayoutTransaction;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DoctorPayoutTransactionRepository extends MongoRepository<DoctorPayoutTransaction, String> {

    Optional<DoctorPayoutTransaction> findByOrganizationIdAndClaimNumberAndDoctorAccountId(
            String organizationId, String claimNumber, String doctorAccountId);

    List<DoctorPayoutTransaction> findByOrganizationId(String organizationId);
}
