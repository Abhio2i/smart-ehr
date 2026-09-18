package com.healthcare.epcr.travel.repository;

import com.healthcare.epcr.travel.model.AccommodationBooking;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AccommodationBookingRepository extends MongoRepository<AccommodationBooking, String> {
    Optional<AccommodationBooking> findByTravelRequestId(String travelRequestId);
    List<AccommodationBooking> findByPatientId(String patientId);
}
