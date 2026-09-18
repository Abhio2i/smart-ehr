package com.healthcare.epcr.billing.repository;

import com.healthcare.epcr.billing.model.ProviderShiftLog;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ProviderShiftLogRepository extends MongoRepository<ProviderShiftLog, String> {
    List<ProviderShiftLog> findByProviderIdAndStatusAndShiftStartBetween(String providerId, String status, LocalDateTime start, LocalDateTime end);
    List<ProviderShiftLog> findByProviderIdAndStatus(String providerId, String status);
    List<ProviderShiftLog> findByProviderIdAndOrganizationIdAndStatus(String providerId, String organizationId, String status);
    List<ProviderShiftLog> findByOrganizationId(String organizationId);
    Optional<ProviderShiftLog> findBySourceTypeAndSourceRefId(String sourceType, String sourceRefId);
    Optional<ProviderShiftLog> findBySourceTypeAndSourceRefIdAndOrganizationId(String sourceType, String sourceRefId, String organizationId);
    List<ProviderShiftLog> findByProviderId(String providerId);
    List<ProviderShiftLog> findByProviderIdAndOrganizationId(String providerId, String organizationId);
}
