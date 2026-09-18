package com.healthcare.epcr.rehab.repository;

import com.healthcare.epcr.rehab.entity.RehabSession;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RehabSessionRepository extends MongoRepository<RehabSession, String> {
    Page<RehabSession> findByTreatmentPlanIdOrderBySessionDateDesc(String treatmentPlanId, Pageable pageable);
    List<RehabSession> findByTreatmentPlanId(String treatmentPlanId);
    List<RehabSession> findByPatientId(String patientId);
}
