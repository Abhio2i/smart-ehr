package com.healthcare.epcr.ed.service;

import com.healthcare.epcr.ed.model.EdPatientRecord;
import com.healthcare.epcr.ed.repository.EdPatientRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class EdTrackingService {

    private final EdPatientRecordRepository edRepository;

    public List<EdPatientRecord> getActiveTrackingBoard(String organizationId) {
        return edRepository.findByOrganizationId(organizationId);
    }

    public EdPatientRecord triagePatient(EdPatientRecord record, String organizationId) {
        if (record.getId() == null || record.getId().isBlank()) {
            record.setId(UUID.randomUUID().toString());
        }
        record.setOrganizationId(organizationId);
        if (record.getArrivalTime() == null) {
            record.setArrivalTime(LocalDateTime.now());
        }
        record.setTriageTime(LocalDateTime.now());
        if (record.getStatus() == null || record.getStatus().isBlank()) {
            record.setStatus("TRIAGED");
        }
        record.setLwbs(false);
        record.setCreatedAt(LocalDateTime.now());
        record.setUpdatedAt(LocalDateTime.now());
        return edRepository.save(record);
    }

    public EdPatientRecord updateDisposition(String id, String dispositionType, String notes, String organizationId) {
        EdPatientRecord record = edRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("ED Patient record not found with ID: " + id));

        record.setDispositionType(dispositionType);
        record.setDispositionNotes(notes);
        record.setDispositionTime(LocalDateTime.now());
        record.setUpdatedAt(LocalDateTime.now());

        if ("LWBS".equalsIgnoreCase(dispositionType)) {
            record.setLwbs(true);
            record.setStatus("LWBS");
        } else if ("DISCHARGE_HOME".equalsIgnoreCase(dispositionType)) {
            record.setStatus("DISCHARGED");
        } else if ("ADMIT_ICU".equalsIgnoreCase(dispositionType) || "ADMIT_WARD".equalsIgnoreCase(dispositionType)) {
            record.setStatus("ADMITTED");
        } else if ("TRANSFER_REGIONAL".equalsIgnoreCase(dispositionType)) {
            record.setStatus("TRANSFERRED");
        }

        return edRepository.save(record);
    }

    public EdPatientRecord markLwbs(String id, String organizationId) {
        return updateDisposition(id, "LWBS", "Patient left ED prior to physician evaluation.", organizationId);
    }
}
