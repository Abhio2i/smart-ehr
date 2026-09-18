package com.healthcare.epcr.retention.repository;

import com.healthcare.epcr.retention.enums.DispositionStatus;
import com.healthcare.epcr.retention.model.DispositionReview;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DispositionReviewRepository extends MongoRepository<DispositionReview, String> {
    List<DispositionReview> findByOrganizationId(String organizationId);
    List<DispositionReview> findByOrganizationIdAndStatus(String organizationId, DispositionStatus status);
    Optional<DispositionReview> findByRecordId(String recordId);
}
