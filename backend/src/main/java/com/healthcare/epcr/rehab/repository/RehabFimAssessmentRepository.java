package com.healthcare.epcr.rehab.repository;

import com.healthcare.epcr.rehab.entity.RehabFimAssessment;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RehabFimAssessmentRepository extends MongoRepository<RehabFimAssessment, String> {
    List<RehabFimAssessment> findByTreatmentPlanIdOrderByAssessedAtDesc(String treatmentPlanId);
    List<RehabFimAssessment> findByPatientId(String patientId);
}
