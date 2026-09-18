package com.healthcare.epcr.dental.repository;

import com.healthcare.epcr.dental.entity.DentalProgramVisit;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface DentalProgramVisitRepository extends MongoRepository<DentalProgramVisit, String> {

    Page<DentalProgramVisit> findByOrganizationId(String organizationId, Pageable pageable);

    List<DentalProgramVisit> findByOrganizationIdAndVisitDateBetween(
            String organizationId, LocalDate start, LocalDate end);

    List<DentalProgramVisit> findBySchoolNameAndOrganizationId(String schoolName, String organizationId);
}
