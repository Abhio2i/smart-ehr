package com.healthcare.epcr.qa.repository;

import com.healthcare.epcr.qa.model.QAReview;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.util.Collection;
import java.util.List;

@Repository
public interface QAReviewRepository extends MongoRepository<QAReview, String> {
    List<QAReview> findByPatientCareRecordId(String patientCareRecordId);
    List<QAReview> findByPatientCareRecordIdIn(Collection<String> patientCareRecordIds);
    boolean existsByPatientCareRecordId(String patientCareRecordId);
    List<QAReview> findByReviewerId(String reviewerId);
    List<QAReview> findByStatus(String status);
    List<QAReview> findByPassed(Boolean passed);
    Page<QAReview> findByReviewerId(String reviewerId, Pageable pageable);
    Page<QAReview> findAllBy(Pageable pageable);
    Page<QAReview> findByStatusIn(Collection<String> statuses, Pageable pageable);
    long countByStatusIn(Collection<String> statuses);
    long countByPatientCareRecordIdIn(Collection<String> patientCareRecordIds);
    long countByPatientCareRecordIdInAndStatusIn(Collection<String> patientCareRecordIds, Collection<String> statuses);
}


