package com.healthcare.epcr.ed.repository;

import com.healthcare.epcr.ed.model.EdPatientRecord;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EdPatientRecordRepository extends MongoRepository<EdPatientRecord, String> {
    List<EdPatientRecord> findByOrganizationId(String organizationId);
    List<EdPatientRecord> findByOrganizationIdAndStatus(String organizationId, String status);
    List<EdPatientRecord> findByOrganizationIdAndLwbs(String organizationId, Boolean lwbs);
    List<EdPatientRecord> findByOrganizationIdAndCtasLevel(String organizationId, Integer ctasLevel);
}
