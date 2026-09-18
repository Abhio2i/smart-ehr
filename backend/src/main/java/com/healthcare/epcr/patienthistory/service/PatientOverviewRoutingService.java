package com.healthcare.epcr.patienthistory.service;

import com.healthcare.epcr.common.exception.ResourceNotFoundException;
import com.healthcare.epcr.epcr.model.PatientCareRecord;
import com.healthcare.epcr.epcr.repository.PatientCareRecordRepository;
import com.healthcare.epcr.patienthistory.model.PatientCondition;
import com.healthcare.epcr.patienthistory.dto.PatientOverviewRouteDTO;
import com.healthcare.epcr.patienthistory.enums.PatientOverviewType;
import com.healthcare.epcr.patienthistory.repository.PatientConditionRepository;
import com.healthcare.epcr.security.AccessControlService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class PatientOverviewRoutingService {
    private static final Map<String, PatientOverviewType> INCIDENT_OVERVIEW_TYPES = Map.ofEntries(
            Map.entry("DENTAL", PatientOverviewType.DENTIST),
            Map.entry("DENTIST", PatientOverviewType.DENTIST),
            Map.entry("ORAL", PatientOverviewType.DENTIST),
            Map.entry("CANCER", PatientOverviewType.ONCOLOGY),
            Map.entry("ONCOLOGY", PatientOverviewType.ONCOLOGY),
            Map.entry("RADIOLOGY", PatientOverviewType.RADIOLOGY),
            Map.entry("IMAGING", PatientOverviewType.RADIOLOGY),
            Map.entry("CARDIAC", PatientOverviewType.CARDIOLOGY),
            Map.entry("NEUROLOGICAL", PatientOverviewType.NEUROLOGY),
            Map.entry("RESPIRATORY", PatientOverviewType.RESPIRATORY),
            Map.entry("OBSTETRIC", PatientOverviewType.OBSTETRIC),
            Map.entry("PEDIATRIC", PatientOverviewType.PEDIATRIC),
            Map.entry("BEHAVIORAL", PatientOverviewType.BEHAVIORAL),
            Map.entry("TRAUMA", PatientOverviewType.TRAUMA)
    );

    private final PatientCareRecordRepository recordRepository;
    private final PatientConditionRepository conditionRepository;
    private final AccessControlService accessControlService;

    public PatientOverviewRouteDTO getRouteByRecord(String recordId) {
        PatientCareRecord record = recordRepository.findById(recordId)
                .orElseGet(() -> resolveRecordFromCondition(recordId));
        accessControlService.assertOrganizationAccess(record.getOrganizationId());
        return route(record.getPatientId(), record.getId(), record.getIncidentType());
    }

    public PatientOverviewRouteDTO getRoute(String patientId, String incidentType) {
        return route(patientId, null, incidentType);
    }

    public PatientOverviewRouteDTO route(String patientId, String recordId, String incidentType) {
        PatientOverviewType overviewType = resolveOverviewType(incidentType);
        return new PatientOverviewRouteDTO(
                patientId,
                recordId,
                incidentType,
                overviewType,
                overviewType.name().toLowerCase(Locale.ROOT)
        );
    }

    public PatientOverviewType resolveOverviewType(String incidentType) {
        if (incidentType == null || incidentType.isBlank()) {
            return PatientOverviewType.GENERAL;
        }
        String normalized = incidentType.trim().toUpperCase(Locale.ROOT)
                .replace('-', '_')
                .replace(' ', '_');
        return INCIDENT_OVERVIEW_TYPES.getOrDefault(normalized, PatientOverviewType.GENERAL);
    }

    private PatientCareRecord resolveRecordFromCondition(String conditionId) {
        PatientCondition condition = conditionRepository.findById(conditionId)
                .orElseThrow(() -> new ResourceNotFoundException("Record not found with id: " + conditionId));
        if (condition.getLinkedEpcrId() == null || condition.getLinkedEpcrId().isBlank()) {
            throw new ResourceNotFoundException("Record not found with id: " + conditionId);
        }
        return recordRepository.findById(condition.getLinkedEpcrId())
                .orElseThrow(() -> new ResourceNotFoundException("Record not found with id: " + condition.getLinkedEpcrId()));
    }
}
