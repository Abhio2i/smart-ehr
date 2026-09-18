package com.healthcare.epcr.patient.service;

import com.healthcare.epcr.auditlog.service.AuditLogService;
import com.healthcare.epcr.common.exception.ResourceNotFoundException;
import com.healthcare.epcr.epcr.model.PatientCareRecord;
import com.healthcare.epcr.epcr.repository.PatientCareRecordRepository;
import com.healthcare.epcr.patient.model.Patient;
import com.healthcare.epcr.patient.repository.PatientRepository;
import com.healthcare.epcr.tb.model.TbCase;
import com.healthcare.epcr.tb.repository.TbCaseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Service to execute patient merges and audit duplicate overrides.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DuplicateMergeService {

    private final PatientRepository patientRepository;
    private final PatientCareRecordRepository epcrRepository;
    private final TbCaseRepository tbCaseRepository;
    private final AuditLogService auditLogService;

    /**
     * Merge secondaryPatientId into primaryPatientId.
     * Re-links all ePCR records and TB cases, then deactivates secondary patient.
     */
    public void mergePatients(String primaryPatientId, String secondaryPatientId, String reason, String userId, String organizationId) {
        if (primaryPatientId.equals(secondaryPatientId)) {
            throw new IllegalArgumentException("Cannot merge a patient into itself.");
        }

        Patient primary = patientRepository.findByPatientId(primaryPatientId)
                .orElseThrow(() -> new ResourceNotFoundException("Primary patient not found: " + primaryPatientId));

        Patient secondary = patientRepository.findByPatientId(secondaryPatientId)
                .orElseThrow(() -> new ResourceNotFoundException("Secondary patient not found: " + secondaryPatientId));

        // 1. Re-link ePCR records
        List<PatientCareRecord> secondaryEpcrRecords = epcrRepository.findByPatientId(secondaryPatientId);
        for (PatientCareRecord rec : secondaryEpcrRecords) {
            rec.setPatientId(primaryPatientId);
            epcrRepository.save(rec);
        }

        // 2. Re-link TB Cases
        List<TbCase> secondaryTbCases = tbCaseRepository.findByPatientId(secondaryPatientId);
        for (TbCase tbCase : secondaryTbCases) {
            tbCase.setPatientId(primaryPatientId);
            tbCaseRepository.save(tbCase);
        }

        // 3. Deactivate secondary patient record
        secondary.setActive(false);
        patientRepository.save(secondary);

        // 4. Audit Log
        auditLogService.logAction(
                userId,
                "MERGE_PATIENTS",
                "Patient",
                primaryPatientId,
                "Merged secondary patient " + secondaryPatientId + " into primary " + primaryPatientId + ". Reason: " + reason
        );

        log.info("Successfully merged patient {} into {} by user {}. Re-linked {} ePCRs and {} TB Cases.",
                secondaryPatientId, primaryPatientId, userId, secondaryEpcrRecords.size(), secondaryTbCases.size());
    }

    /**
     * Audit log a user's decision to override a duplicate warning.
     */
    public void logDuplicateOverride(String patientId, String flaggedPatientId, String reason, String userId, String organizationId) {
        auditLogService.logAction(
                userId,
                "OVERRIDE_DUPLICATE_WARNING",
                "Patient",
                patientId,
                "User explicitly overridden duplicate warning against candidate patient " + flaggedPatientId + ". Reason: " + reason
        );
        log.info("User {} overridden duplicate warning for patient {} (against {}). Reason: {}",
                userId, patientId, flaggedPatientId, reason);
    }
}
