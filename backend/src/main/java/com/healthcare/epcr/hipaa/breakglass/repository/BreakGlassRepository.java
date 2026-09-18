package com.healthcare.epcr.hipaa.breakglass.repository;

import com.healthcare.epcr.hipaa.breakglass.model.BreakGlassEvent;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface BreakGlassRepository extends MongoRepository<BreakGlassEvent, String> {
    List<BreakGlassEvent> findByStatusOrderByStartedAtDesc(String status);
    List<BreakGlassEvent> findByOrganizationIdOrderByStartedAtDesc(String organizationId);
    List<BreakGlassEvent> findByUserIdAndPatientIdAndStatus(String userId, String patientId, String status);
}

