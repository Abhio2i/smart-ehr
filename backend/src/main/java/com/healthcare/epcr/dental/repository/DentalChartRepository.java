package com.healthcare.epcr.dental.repository;

import com.healthcare.epcr.dental.entity.DentalChart;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DentalChartRepository extends MongoRepository<DentalChart, String> {

    Optional<DentalChart> findByPatientId(String patientId);

    Page<DentalChart> findByOrganizationId(String organizationId, Pageable pageable);

    boolean existsByPatientId(String patientId);
}
