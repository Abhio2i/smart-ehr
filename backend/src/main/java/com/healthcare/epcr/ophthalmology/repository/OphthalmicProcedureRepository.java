package com.healthcare.epcr.ophthalmology.repository;

import com.healthcare.epcr.ophthalmology.entity.OphthalmicProcedure;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface OphthalmicProcedureRepository extends MongoRepository<OphthalmicProcedure, String> {
    List<OphthalmicProcedure> findByPatientId(String patientId);
    List<OphthalmicProcedure> findBySurgicalCaseId(String surgicalCaseId);
}
