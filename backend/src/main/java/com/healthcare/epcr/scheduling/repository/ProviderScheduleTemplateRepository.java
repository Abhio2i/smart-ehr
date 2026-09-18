package com.healthcare.epcr.scheduling.repository;

import com.healthcare.epcr.scheduling.model.ProviderScheduleTemplate;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProviderScheduleTemplateRepository extends MongoRepository<ProviderScheduleTemplate, String> {
    List<ProviderScheduleTemplate> findByActiveTrue();
    List<ProviderScheduleTemplate> findByOrganizationId(String organizationId);
    List<ProviderScheduleTemplate> findByProviderId(String providerId);

    // ── NEW ──────────────────────────────────────────────────────────────────
    /** Active templates for a specific org (Manager view) */
    List<ProviderScheduleTemplate> findByOrganizationIdAndActiveTrue(String organizationId);

    /** Active templates for a specific provider (used during slot generation) */
    List<ProviderScheduleTemplate> findByProviderIdAndActiveTrue(String providerId);

    /** Delete all templates for a provider (used when provider is deactivated) */
    void deleteByProviderId(String providerId);
}

