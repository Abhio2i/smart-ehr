package com.healthcare.epcr.patienthistory.repository;

import com.healthcare.epcr.patienthistory.model.PatientClinicalOrder;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PatientClinicalOrderRepository extends MongoRepository<PatientClinicalOrder, String> {
    List<PatientClinicalOrder> findByPatientId(String patientId);
    List<PatientClinicalOrder> findByLinkedEpcrId(String linkedEpcrId);
}
