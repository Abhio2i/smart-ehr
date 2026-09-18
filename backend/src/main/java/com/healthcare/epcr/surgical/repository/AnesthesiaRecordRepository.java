package com.healthcare.epcr.surgical.repository;

import com.healthcare.epcr.surgical.model.AnesthesiaRecord;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface AnesthesiaRecordRepository extends MongoRepository<AnesthesiaRecord, String> {

    /** One anesthesia record per surgical case (unique index enforced on model). */
    Optional<AnesthesiaRecord> findBySurgicalCaseId(String surgicalCaseId);

    boolean existsBySurgicalCaseId(String surgicalCaseId);
}
