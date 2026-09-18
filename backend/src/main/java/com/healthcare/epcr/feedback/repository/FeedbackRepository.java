package com.healthcare.epcr.feedback.repository;

import com.healthcare.epcr.feedback.model.FeedbackThread;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface FeedbackRepository extends MongoRepository<FeedbackThread, String> {
    List<FeedbackThread> findByPatientCareRecordId(String patientCareRecordId);
    List<FeedbackThread> findByInitiatedBy(String initiatedBy);
    List<FeedbackThread> findByStatus(String status);
}


