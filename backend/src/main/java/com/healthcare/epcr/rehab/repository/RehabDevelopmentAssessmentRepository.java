package com.healthcare.epcr.rehab.repository;

import com.healthcare.epcr.rehab.entity.RehabDevelopmentAssessment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RehabDevelopmentAssessmentRepository extends MongoRepository<RehabDevelopmentAssessment, String> {
    List<RehabDevelopmentAssessment> findByPatientId(String patientId);
    Page<RehabDevelopmentAssessment> findByAssessmentType(String assessmentType, Pageable pageable);
}
