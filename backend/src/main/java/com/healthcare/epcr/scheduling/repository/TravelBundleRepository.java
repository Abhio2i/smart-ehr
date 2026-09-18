package com.healthcare.epcr.scheduling.repository;

import com.healthcare.epcr.scheduling.model.TravelBundle;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TravelBundleRepository extends MongoRepository<TravelBundle, String> {
    List<TravelBundle> findByPatientId(String patientId);
    List<TravelBundle> findByOrganizationId(String organizationId);
    List<TravelBundle> findByPatientIdAndDestinationFacilityIdAndStatus(
            String patientId, String destinationFacilityId, String status);

    // ── NEW ──────────────────────────────────────────────────────────────────
    /** Count for stats endpoint */
    long countByOrganizationId(String organizationId);
}
