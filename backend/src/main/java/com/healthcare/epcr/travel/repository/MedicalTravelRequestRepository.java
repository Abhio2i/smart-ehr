package com.healthcare.epcr.travel.repository;

import com.healthcare.epcr.travel.model.MedicalTravelRequest;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MedicalTravelRequestRepository extends MongoRepository<MedicalTravelRequest, String> {
    List<MedicalTravelRequest> findByPatientId(String patientId);
    Optional<MedicalTravelRequest> findByEpcrRecordId(String epcrRecordId);
}
