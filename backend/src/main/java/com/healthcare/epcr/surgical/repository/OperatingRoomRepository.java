package com.healthcare.epcr.surgical.repository;

import com.healthcare.epcr.surgical.model.OperatingRoom;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface OperatingRoomRepository extends MongoRepository<OperatingRoom, String> {

    /** All ORs for an organization. */
    List<OperatingRoom> findByOrganizationId(String organizationId);

    /** ORs for a specific facility. */
    List<OperatingRoom> findByFacilityIdAndOrganizationId(String facilityId, String organizationId);

    /** Active ORs only. */
    List<OperatingRoom> findByOrganizationIdAndActiveTrue(String organizationId);

    /** Duplicate guard before creating a new OR. */
    boolean existsByRoomNumberAndFacilityIdAndOrganizationId(
            String roomNumber, String facilityId, String organizationId);

    Optional<OperatingRoom> findByIdAndOrganizationId(String id, String organizationId);
}
