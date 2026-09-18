package com.healthcare.epcr.epcr.service;

import com.healthcare.epcr.epcr.dto.PatientCareRecordDTO;
import com.healthcare.epcr.epcr.dto.CreatePatientCareRecordRequest;
import com.healthcare.epcr.epcr.enums.RecordStatus;
import com.healthcare.epcr.common.dto.PageResponse;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface IPatientCareRecordService {
    List<String> getIncidentTypes();
    PatientCareRecordDTO createRecord(CreatePatientCareRecordRequest request);
    PatientCareRecordDTO createRecord(CreatePatientCareRecordRequest request, String idempotencyKey);
    Optional<PatientCareRecordDTO> getRecordById(String id);
    List<PatientCareRecordDTO> getRecordsByParamedic(String paramedicsId);
    List<PatientCareRecordDTO> getRecordsByOrganization(String organizationId);
    List<PatientCareRecordDTO> getRecordsByStatus(RecordStatus status);
    List<PatientCareRecordDTO> getPendingQAApproval();
    PatientCareRecordDTO updateRecord(String id, CreatePatientCareRecordRequest request);
    PatientCareRecordDTO submitRecord(String id);
    void deleteRecord(String id);
    List<PatientCareRecordDTO> getAllRecords();
    PageResponse<PatientCareRecordDTO> getAllRecordsPaginated(
            int page, int size, String paramedicId,
            RecordStatus status, String incidentType, String search,
            LocalDateTime startDate, LocalDateTime endDate);

    // ── FHIR helper methods ─────────────────────────────────────────────────
    /** Returns all ePCR records linked to a given patient ID. */
    List<PatientCareRecordDTO> getRecordsByPatientId(String patientId);

    /** Returns the most-recently-updated ePCR record for a patient, used by FHIR mappers. */
    Optional<PatientCareRecordDTO> getLatestRecordByPatientId(String patientId);

    /** Search patients/records by name and/or phone for demographic search */
    List<PatientCareRecordDTO> searchRecordsByDemographics(String name, String phone);
}
