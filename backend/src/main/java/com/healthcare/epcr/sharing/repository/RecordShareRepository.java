package com.healthcare.epcr.sharing.repository;

import com.healthcare.epcr.sharing.enums.ShareStatus;
import com.healthcare.epcr.sharing.model.RecordShare;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface RecordShareRepository extends MongoRepository<RecordShare, String> {

    List<RecordShare> findByOrganizationIdAndRecordId(String organizationId, String recordId);

    Page<RecordShare> findBySpecialistUserIdOrSharedByUserIdOrderByCreatedAtDesc(String specialistUserId, String sharedByUserId, Pageable pageable);

    Page<RecordShare> findByOrganizationIdOrderByCreatedAtDesc(String organizationId, Pageable pageable);

    Page<RecordShare> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Optional<RecordShare> findByIdAndOrganizationId(String id, String organizationId);

    List<RecordShare> findByStatusAndExpiresAtBefore(ShareStatus status, Instant cutoff);
}
