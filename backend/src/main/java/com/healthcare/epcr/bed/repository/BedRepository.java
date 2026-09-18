package com.healthcare.epcr.bed.repository;

import com.healthcare.epcr.bed.model.Bed;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BedRepository extends MongoRepository<Bed, String> {

    // ── Org-scoped queries (Manager / Paramedic) ───────────────────────────────
    List<Bed> findByOrganizationId(String organizationId);

    List<Bed> findByOrganizationIdAndWardName(String organizationId, String wardName);

    // ── Admin cross-org queries ────────────────────────────────────────────────
    List<Bed> findByFacilityNameAndWardName(String facilityName, String wardName);

    List<Bed> findByFacilityName(String facilityName);

    // ── Duplicate-prevention check ────────────────────────────────────────────
    boolean existsByBedNumberAndFacilityNameAndOrganizationId(
            String bedNumber, String facilityName, String organizationId);

    // ── Stats helper ──────────────────────────────────────────────────────────
    List<Bed> findByOrganizationIdIn(List<String> organizationIds);

    // ── Patient occupancy checks ──────────────────────────────────────────────
    java.util.Optional<Bed> findByOccupiedByPatientIdAndStatus(String occupiedByPatientId, com.healthcare.epcr.bed.model.BedStatus status);

    List<Bed> findByStatusAndReleaseDateTimeBefore(com.healthcare.epcr.bed.model.BedStatus status, java.time.LocalDateTime dateTime);
}
