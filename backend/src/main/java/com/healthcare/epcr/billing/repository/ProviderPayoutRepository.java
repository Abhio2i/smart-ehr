package com.healthcare.epcr.billing.repository;

import com.healthcare.epcr.billing.model.ProviderPayout;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProviderPayoutRepository extends MongoRepository<ProviderPayout, String> {
    List<ProviderPayout> findByProviderId(String providerId);
    List<ProviderPayout> findByOrganizationId(String organizationId);
    List<ProviderPayout> findByProviderIdAndApprovalStatus(String providerId, String approvalStatus);
    List<ProviderPayout> findByOrganizationIdAndApprovalStatus(String organizationId, String approvalStatus);
}
