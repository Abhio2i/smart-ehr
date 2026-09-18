package com.healthcare.epcr.homecare.repository;

import com.healthcare.epcr.homecare.model.NurseCaseload;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface NurseCaseloadRepository extends MongoRepository<NurseCaseload, String> {

    Optional<NurseCaseload> findByNurseIdAndDate(String nurseId, String date);

    List<NurseCaseload> findByOrganizationIdAndDate(String organizationId, String date);

    /** Find nurses covering a specific community — for suggest-nurses. */
    List<NurseCaseload> findByOrganizationIdAndAssignedCommunitiesContainingAndDate(
            String organizationId, String community, String date);
}
