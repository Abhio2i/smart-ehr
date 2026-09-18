package com.healthcare.epcr.billing.repository;

import com.healthcare.epcr.billing.model.ProviderPaymentRate;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProviderPaymentRateRepository extends MongoRepository<ProviderPaymentRate, String> {
    Optional<ProviderPaymentRate> findByProviderIdAndActiveTrue(String providerId);
    Optional<ProviderPaymentRate> findByProviderIdAndOrganizationIdAndActiveTrue(String providerId, String organizationId);
    List<ProviderPaymentRate> findByOrganizationId(String organizationId);
    List<ProviderPaymentRate> findByProviderIdAndOrganizationId(String providerId, String organizationId);
    Optional<ProviderPaymentRate> findByProviderId(String providerId);
}
