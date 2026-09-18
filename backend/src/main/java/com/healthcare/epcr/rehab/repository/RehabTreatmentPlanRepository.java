package com.healthcare.epcr.rehab.repository;

import com.healthcare.epcr.rehab.entity.RehabTreatmentPlan;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RehabTreatmentPlanRepository extends MongoRepository<RehabTreatmentPlan, String> {
    Optional<RehabTreatmentPlan> findByPlanNumber(String planNumber);
    List<RehabTreatmentPlan> findByPatientId(String patientId);
    Page<RehabTreatmentPlan> findByDiscipline(String discipline, Pageable pageable);
    Page<RehabTreatmentPlan> findByStatus(String status, Pageable pageable);
    Page<RehabTreatmentPlan> findByDisciplineAndStatus(String discipline, String status, Pageable pageable);
}
