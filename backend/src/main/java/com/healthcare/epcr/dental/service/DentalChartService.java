package com.healthcare.epcr.dental.service;

import com.healthcare.epcr.dental.dto.ToothEntryRequest;
import com.healthcare.epcr.dental.dto.TreatmentRequest;
import com.healthcare.epcr.dental.entity.DentalChart;
import com.healthcare.epcr.dental.repository.DentalChartRepository;
import com.healthcare.epcr.security.AccessControlService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DentalChartService {

    private final DentalChartRepository dentalChartRepository;
    private final AccessControlService accessControlService;

    /**
     * Fetch the patient's chart, creating an empty one on first access.
     */
    public DentalChart getOrCreateChart(String patientId, String organizationId, String facilityId) {
        DentalChart existing = dentalChartRepository.findByPatientId(patientId).orElse(null);
        if (existing != null) {
            return existing;
        }

        String effectiveOrgId = (organizationId != null && !organizationId.isBlank())
                ? organizationId
                : "ORG-DEFAULT";

        DentalChart newChart = DentalChart.builder()
                .patientId(patientId)
                .organizationId(effectiveOrgId)
                .facilityId(facilityId)
                .toothChart(new ArrayList<>())
                .treatments(new ArrayList<>())
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
        return dentalChartRepository.save(newChart);
    }

    public DentalChart saveFullChart(String patientId, DentalChart incoming, String organizationId, String facilityId) {
        DentalChart chart = getOrCreateChart(patientId, organizationId, facilityId);
        if (incoming != null) {
            if (incoming.getToothChart() != null) {
                chart.setToothChart(incoming.getToothChart());
            }
            if (incoming.getTreatments() != null) {
                chart.setTreatments(incoming.getTreatments());
            }
        }
        chart.setUpdatedAt(LocalDateTime.now());
        return dentalChartRepository.save(chart);
    }

    /**
     * Upsert a single tooth entry for a patient's dental chart.
     */
    public DentalChart upsertToothEntry(String patientId, ToothEntryRequest request,
                                         String organizationId, String facilityId) {

        DentalChart chart = getOrCreateChart(patientId, organizationId, facilityId);

        DentalChart.ToothEntry entry = DentalChart.ToothEntry.builder()
                .toothNumber(request.getToothNumber())
                .condition(request.getCondition())
                .surfaceNotes(request.getSurfaceNotes())
                .recordedAt(LocalDateTime.now())
                .build();

        List<DentalChart.ToothEntry> list = chart.getToothChart();
        if (list == null) {
            list = new ArrayList<>();
            chart.setToothChart(list);
        }

        // Replace existing tooth entry if present, otherwise append
        int existingIndex = -1;
        for (int i = 0; i < list.size(); i++) {
            if (list.get(i).getToothNumber() != null && list.get(i).getToothNumber().equals(request.getToothNumber())) {
                existingIndex = i;
                break;
            }
        }

        if (existingIndex >= 0) {
            list.set(existingIndex, entry);
        } else {
            list.add(entry);
        }

        chart.setLastExamDate(LocalDateTime.now());
        chart.setUpdatedAt(LocalDateTime.now());

        return dentalChartRepository.save(chart);
    }

    /**
     * Add a treatment record to a patient's dental chart.
     */
    public DentalChart addTreatment(String patientId, TreatmentRequest request,
                                     String performedBy, String performedByName,
                                     String organizationId, String facilityId) {

        DentalChart chart = getOrCreateChart(patientId, organizationId, facilityId);

        DentalChart.TreatmentRecord record = DentalChart.TreatmentRecord.builder()
                .treatmentId(UUID.randomUUID().toString().substring(0, 8))
                .toothNumber(request.getToothNumber())
                .type(request.getType())
                .performedBy(performedBy)
                .performedByName(performedByName)
                .providerRole(request.getProviderRole())
                .performedAt(LocalDateTime.now())
                .notes(request.getNotes())
                .build();

        List<DentalChart.TreatmentRecord> list = chart.getTreatments();
        if (list == null) {
            list = new ArrayList<>();
            chart.setTreatments(list);
        }
        list.add(record);

        chart.setLastExaminedBy(performedBy);
        chart.setLastExaminedByName(performedByName);
        chart.setLastExamDate(LocalDateTime.now());
        chart.setUpdatedAt(LocalDateTime.now());

        return dentalChartRepository.save(chart);
    }

    public DentalChart getByPatient(String patientId) {
        return getOrCreateChart(patientId, null, null);
    }

    public Page<DentalChart> getByOrganization(String organizationId, Pageable pageable) {
        String targetOrg = organizationId != null && !organizationId.isBlank()
                ? organizationId
                : accessControlService.currentUser().getOrganizationId();
        accessControlService.assertOrganizationAccess(targetOrg);
        return dentalChartRepository.findByOrganizationId(targetOrg, pageable);
    }
}
