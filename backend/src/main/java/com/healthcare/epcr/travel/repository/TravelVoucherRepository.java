package com.healthcare.epcr.travel.repository;

import com.healthcare.epcr.travel.model.TravelVoucher;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TravelVoucherRepository extends MongoRepository<TravelVoucher, String> {
    Optional<TravelVoucher> findByTravelRequestId(String travelRequestId);
    List<TravelVoucher> findByPatientId(String patientId);
}
