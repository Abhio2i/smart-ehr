package com.healthcare.epcr.fhir.controller;

import com.healthcare.epcr.epcr.dto.PatientCareRecordDTO;
import com.healthcare.epcr.epcr.service.IPatientCareRecordService;
import com.healthcare.epcr.fhir.mapper.FhirConditionMapper;
import com.healthcare.epcr.fhir.mapper.FhirEncounterMapper;
import com.healthcare.epcr.fhir.mapper.FhirMedicationAdminMapper;
import com.healthcare.epcr.fhir.mapper.FhirObservationMapper;
import com.healthcare.epcr.fhir.mapper.FhirPatientMapper;
import com.healthcare.epcr.fhir.mapper.FhirProcedureMapper;
import com.healthcare.epcr.fhir.mapper.FhirSummaryDocumentMapper;
import com.healthcare.epcr.fhir.mapper.FhirSurgicalMapper;
import com.healthcare.epcr.surgical.model.AnesthesiaRecord;
import com.healthcare.epcr.surgical.model.SurgicalCase;
import com.healthcare.epcr.surgical.repository.AnesthesiaRecordRepository;
import com.healthcare.epcr.surgical.repository.SurgicalCaseRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * FHIR R4 REST endpoints — exposes ePCR data as standards-compliant FHIR resources.
 *
 * All endpoints require a valid Bearer JWT token (same as the rest of the API).
 * Resources are mapped on-the-fly from the existing MongoDB documents — no separate FHIR store.
 *
 * Supported resources:
 *   GET /api/fhir/Patient/{patientId}
 *   GET /api/fhir/Patient/{patientId}/$summary
 *   GET /api/fhir/Encounter/{encounterId}
 *   GET /api/fhir/Observation?patient={patientId}
 *   GET /api/fhir/MedicationAdministration?patient={patientId}
 *   GET /api/fhir/Condition?patient={patientId}
 *   GET /api/fhir/Procedure?patient={patientId}
 */
@RestController
@RequestMapping("/api/fhir")
@RequiredArgsConstructor
@Tag(name = "FHIR R4", description = "HL7 FHIR R4 compliant resource endpoints for interoperability")
public class FhirController {

    private final IPatientCareRecordService epcrService;
    private final com.healthcare.epcr.scheduling.repository.AppointmentRepository appointmentRepository;
    private final SurgicalCaseRepository surgicalCaseRepository;
    private final AnesthesiaRecordRepository anesthesiaRecordRepository;

    // ─────────────────────────────────────────────────────────────────────────
    //  Patient
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/Patient/{patientId}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PARAMEDIC','QA_REVIEWER','PHYSICIAN','VIEWER')")
    @Operation(
        summary = "FHIR Patient by patientId",
        description = "Returns demographics of the latest ePCR record for the given patient as a FHIR R4 Patient resource."
    )
    public ResponseEntity<Map<String, Object>> getPatient(
            @Parameter(description = "ePCR patient ID (e.g. PAT-XXXXXXXX)") @PathVariable String patientId) {

        Optional<PatientCareRecordDTO> record = epcrService.getLatestRecordByPatientId(patientId);
        if (record.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(FhirPatientMapper.toPatient(record.get()));
    }

    @GetMapping("/Patient/{patientId}/$summary")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PARAMEDIC','QA_REVIEWER','PHYSICIAN','VIEWER')")
    @Operation(
        summary = "FHIR Patient Summary (PS-CA) Document Bundle",
        description = "Generates a standard-compliant pan-Canadian FHIR R4 Patient Summary Document Bundle for the patient."
    )
    public ResponseEntity<Map<String, Object>> getPatientSummary(
            @Parameter(description = "ePCR patient ID (e.g. PAT-XXXXXXXX)") @PathVariable String patientId) {

        Optional<PatientCareRecordDTO> record = epcrService.getLatestRecordByPatientId(patientId);
        if (record.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(FhirSummaryDocumentMapper.toPatientSummary(record.get()));
    }

    @GetMapping("/Patient")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PARAMEDIC','QA_REVIEWER','PHYSICIAN','VIEWER')")
    @Operation(
        summary = "Search FHIR Patients by Demographics",
        description = "Searches patient records by name (case-insensitive contains) and/or phone number, returning a list of FHIR R4 Patient resources."
    )
    public List<Map<String, Object>> searchPatients(
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String phone) {

        List<PatientCareRecordDTO> records = epcrService.searchRecordsByDemographics(name, phone);
        List<Map<String, Object>> patients = new ArrayList<>();
        java.util.Set<String> processedIds = new java.util.HashSet<>();

        for (PatientCareRecordDTO record : records) {
            if (record.getPatientId() != null && processedIds.add(record.getPatientId())) {
                patients.add(FhirPatientMapper.toPatient(record));
            }
        }
        return patients;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Encounter
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/Encounter/{encounterId}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PARAMEDIC','QA_REVIEWER','PHYSICIAN','VIEWER')")
    @Operation(
        summary = "FHIR Encounter by record ID",
        description = "Returns an ePCR incident as a FHIR R4 Encounter resource. encounterId = ePCR record ID."
    )
    public ResponseEntity<Map<String, Object>> getEncounter(
            @Parameter(description = "ePCR record ID (MongoDB _id)") @PathVariable String encounterId) {

        Optional<PatientCareRecordDTO> record = epcrService.getRecordById(encounterId);
        if (record.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(FhirEncounterMapper.toEncounter(record.get()));
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Observation (vital signs)
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/Observation")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PARAMEDIC','QA_REVIEWER','PHYSICIAN','VIEWER')")
    @Operation(
        summary = "FHIR Observations (vital signs) by patient",
        description = "Returns vital-signs observations from the latest ePCR record for the given patient. Pass category=vital-signs (optional, informational only)."
    )
    public List<Map<String, Object>> getObservations(
            @Parameter(description = "ePCR patient ID") @RequestParam String patient,
            @Parameter(description = "FHIR category filter (informational; only vital-signs supported)") @RequestParam(required = false) String category) {

        Optional<PatientCareRecordDTO> recordOpt = epcrService.getLatestRecordByPatientId(patient);
        if (recordOpt.isEmpty() || recordOpt.get().getStructuredVitals() == null) {
            return List.of();
        }

        PatientCareRecordDTO record = recordOpt.get();
        List<Map<String, Object>> observations = new ArrayList<>();
        for (int i = 0; i < record.getStructuredVitals().size(); i++) {
            String uid = record.getId() + "-vital-" + i;
            observations.add(FhirObservationMapper.vitalSignsObservation(
                record.getStructuredVitals().get(i), patient, record.getId(), uid));
        }
        return observations;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  MedicationAdministration
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/MedicationAdministration")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PARAMEDIC','QA_REVIEWER','PHYSICIAN','VIEWER')")
    @Operation(
        summary = "FHIR MedicationAdministration by patient",
        description = "Returns all medications administered during the latest ePCR encounter as FHIR R4 MedicationAdministration resources."
    )
    public List<Map<String, Object>> getMedications(
            @Parameter(description = "ePCR patient ID") @RequestParam String patient) {

        Optional<PatientCareRecordDTO> recordOpt = epcrService.getLatestRecordByPatientId(patient);
        if (recordOpt.isEmpty() || recordOpt.get().getStructuredMedications() == null) {
            return List.of();
        }

        PatientCareRecordDTO record = recordOpt.get();
        List<Map<String, Object>> meds = new ArrayList<>();
        for (int i = 0; i < record.getStructuredMedications().size(); i++) {
            String uid = record.getId() + "-med-" + i;
            meds.add(FhirMedicationAdminMapper.toMedicationAdministration(
                record.getStructuredMedications().get(i), patient, record.getId(), uid));
        }
        return meds;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Condition
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/Condition")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PARAMEDIC','QA_REVIEWER','PHYSICIAN','VIEWER')")
    @Operation(
        summary = "FHIR Condition (diagnosis) by patient",
        description = "Returns the primary diagnosis from the latest ePCR record as a FHIR R4 Condition resource."
    )
    public List<Map<String, Object>> getConditions(
            @Parameter(description = "ePCR patient ID") @RequestParam String patient) {

        Optional<PatientCareRecordDTO> recordOpt = epcrService.getLatestRecordByPatientId(patient);
        if (recordOpt.isEmpty()) {
            return List.of();
        }

        PatientCareRecordDTO record = recordOpt.get();
        List<Map<String, Object>> conditions = new ArrayList<>();

        // Primary diagnosis
        if (record.getDiagnosis() != null || record.getIcd10Code() != null) {
            conditions.add(FhirConditionMapper.toCondition(
                record.getIcd10Code(), record.getDiagnosis(),
                patient, record.getId(), record.getId() + "-cond-0"));
        }

        // Secondary impression (if different)
        if (record.getSecondaryImpression() != null &&
                !record.getSecondaryImpression().equals(record.getDiagnosis())) {
            conditions.add(FhirConditionMapper.toCondition(
                null, record.getSecondaryImpression(),
                patient, record.getId(), record.getId() + "-cond-1"));
        }

        return conditions;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Procedure
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/Procedure")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PARAMEDIC','QA_REVIEWER','PHYSICIAN','VIEWER')")
    @Operation(
        summary = "FHIR Procedure by patient",
        description = "Returns procedures performed during the latest ePCR encounter as FHIR R4 Procedure resources."
    )
    public List<Map<String, Object>> getProcedures(
            @Parameter(description = "ePCR patient ID") @RequestParam String patient) {

        Optional<PatientCareRecordDTO> recordOpt = epcrService.getLatestRecordByPatientId(patient);
        if (recordOpt.isEmpty() || recordOpt.get().getStructuredProcedures() == null) {
            return List.of();
        }

        PatientCareRecordDTO record = recordOpt.get();
        List<Map<String, Object>> procedures = new ArrayList<>();
        for (int i = 0; i < record.getStructuredProcedures().size(); i++) {
            String uid = record.getId() + "-proc-" + i;
            procedures.add(FhirProcedureMapper.toProcedure(
                record.getStructuredProcedures().get(i), patient, record.getId(), uid));
        }
        return procedures;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Appointment
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/Appointment/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PARAMEDIC','QA_REVIEWER','PHYSICIAN','VIEWER')")
    @Operation(
        summary = "FHIR Appointment by ID",
        description = "Returns a scheduling appointment mapped as a FHIR R4 Appointment resource."
    )
    public ResponseEntity<Map<String, Object>> getFhirAppointment(@PathVariable String id) {
        return appointmentRepository.findById(id)
                .map(appt -> ResponseEntity.ok(com.healthcare.epcr.fhir.mapper.FhirAppointmentMapper.toFhir(appt)))
                .orElse(ResponseEntity.notFound().build());
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Surgical Procedure (FHIR R4 Procedure from SurgicalCase)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * GET /api/fhir/Procedure/{surgicalCaseId}
     * Maps a SurgicalCase to a FHIR R4 Procedure resource.
     */
    @GetMapping("/Procedure/{surgicalCaseId}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PARAMEDIC','QA_REVIEWER','PHYSICIAN','VIEWER')")
    @Operation(
        summary = "FHIR Procedure from SurgicalCase",
        description = "Returns a SurgicalCase mapped as a FHIR R4 Procedure resource (SNOMED code, performedPeriod, performers)."
    )
    public ResponseEntity<Map<String, Object>> getSurgicalProcedure(
            @Parameter(description = "Surgical case ID") @PathVariable String surgicalCaseId) {
        return surgicalCaseRepository.findById(surgicalCaseId)
                .map(sc -> ResponseEntity.ok(FhirSurgicalMapper.toProcedure(sc)))
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * GET /api/fhir/Procedure/{surgicalCaseId}/anesthesia-report
     * Returns a composite FHIR Bundle with the Procedure + all Observation resources
     * built from the intra-operative vitals timeline.
     */
    @GetMapping("/Procedure/{surgicalCaseId}/anesthesia-report")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PARAMEDIC','QA_REVIEWER','PHYSICIAN','VIEWER')")
    @Operation(
        summary = "FHIR Anesthesia Report Bundle",
        description = "Composite FHIR Bundle: Procedure + Observation resources from intra-operative vitals timeline."
    )
    public ResponseEntity<Map<String, Object>> getAnesthesiaReport(
            @Parameter(description = "Surgical case ID") @PathVariable String surgicalCaseId) {
        Optional<SurgicalCase> scOpt = surgicalCaseRepository.findById(surgicalCaseId);
        if (scOpt.isEmpty()) return ResponseEntity.notFound().build();
        SurgicalCase sc = scOpt.get();
        AnesthesiaRecord rec = anesthesiaRecordRepository.findBySurgicalCaseId(surgicalCaseId).orElse(null);
        return ResponseEntity.ok(FhirSurgicalMapper.toAnesthesiaBundle(sc, rec));
    }
}
