package com.healthcare.epcr.billing.repository;

import com.healthcare.epcr.billing.model.DoctorPaymentAccount;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DoctorPaymentAccountRepository extends MongoRepository<DoctorPaymentAccount, String> {
    List<DoctorPaymentAccount> findByOrganizationId(String organizationId);
    Optional<DoctorPaymentAccount> findByOrganizationIdAndDoctorUserId(String organizationId, String doctorUserId);
}
