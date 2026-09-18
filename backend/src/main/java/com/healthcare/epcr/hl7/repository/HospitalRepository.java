package com.healthcare.epcr.hl7.repository;

import com.healthcare.epcr.hl7.model.Hospital;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface HospitalRepository extends MongoRepository<Hospital, String> {
    Optional<Hospital> findByNameIgnoreCase(String name);
    java.util.List<Hospital> findByNameContainingIgnoreCase(String name);
}
