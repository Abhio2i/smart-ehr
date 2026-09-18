package com.healthcare.epcr.patienthistory.repository;

import com.healthcare.epcr.patienthistory.model.MedicationOrder;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MedicationOrderRepository extends MongoRepository<MedicationOrder, String> {
    List<MedicationOrder> findByPatientId(String patientId);
    List<MedicationOrder> findByPatientIdAndOrderStatus(String patientId, String orderStatus);
}
