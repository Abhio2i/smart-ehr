package com.healthcare.epcr.ltc.repository;

import com.healthcare.epcr.ltc.entity.LtcResident;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LtcResidentRepository extends MongoRepository<LtcResident, String> {
    Page<LtcResident> findByOrganizationIdAndFacilityIdAndStatusIn(
        String organizationId, String facilityId, List<LtcResident.ResidentStatus> statuses, Pageable pageable);

    Optional<LtcResident> findByPatientIdAndStatusIn(
        String patientId, List<LtcResident.ResidentStatus> statuses);

    Page<LtcResident> findByOrganizationId(String organizationId, Pageable pageable);
}
