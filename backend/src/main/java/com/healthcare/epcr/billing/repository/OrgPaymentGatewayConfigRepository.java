package com.healthcare.epcr.billing.repository;

import com.healthcare.epcr.billing.model.OrgPaymentGatewayConfig;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface OrgPaymentGatewayConfigRepository extends MongoRepository<OrgPaymentGatewayConfig, String> {
    Optional<OrgPaymentGatewayConfig> findByOrganizationId(String organizationId);
    Optional<OrgPaymentGatewayConfig> findByOrganizationIdAndActiveTrue(String organizationId);
}
