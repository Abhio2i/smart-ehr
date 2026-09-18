package com.healthcare.epcr.epcr.repository;

import com.healthcare.epcr.epcr.model.PatientCareRecord;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;
import com.healthcare.epcr.epcr.enums.RecordStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface PatientCareRecordRepository extends MongoRepository<PatientCareRecord, String> {
    List<PatientCareRecord> findByParamedicsId(String paramedicsId);
    Page<PatientCareRecord> findByParamedicsId(String paramedicsId, Pageable pageable);
    List<PatientCareRecord> findByOrganizationId(String organizationId);
    Page<PatientCareRecord> findByOrganizationId(String organizationId, Pageable pageable);
    Page<PatientCareRecord> findByOrganizationIdAndParamedicsId(String organizationId, String paramedicsId, Pageable pageable);
    List<PatientCareRecord> findByPatientId(String patientId);
    boolean existsByIncidentNumber(String incidentNumber);
    boolean existsByPatientId(String patientId);
    Optional<PatientCareRecord> findByIdAndPatientId(String id, String patientId);
    Optional<PatientCareRecord> findByIdAndOrganizationId(String id, String organizationId);
    List<PatientCareRecord> findByStatus(RecordStatus status);
    List<PatientCareRecord> findByQaApproved(Boolean qaApproved);
    List<PatientCareRecord> findByStatusAndQaApproved(RecordStatus status, Boolean qaApproved);
    Page<PatientCareRecord> findAllBy(Pageable pageable);
    long countByStatus(RecordStatus status);
    long countByStatusAndQaApproved(RecordStatus status, Boolean qaApproved);
    long countByOrganizationId(String organizationId);
    long countByOrganizationIdAndStatus(String organizationId, RecordStatus status);
    long countByParamedicsIdAndStatus(String paramedicsId, RecordStatus status);
    List<PatientCareRecord> findTop5ByOrderByUpdatedAtDesc();
    List<PatientCareRecord> findTop5ByOrganizationIdOrderByUpdatedAtDesc(String organizationId);
    List<PatientCareRecord> findTop5ByParamedicsIdOrderByUpdatedAtDesc(String paramedicsId);
}


