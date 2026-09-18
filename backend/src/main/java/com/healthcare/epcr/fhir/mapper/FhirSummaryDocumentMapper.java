package com.healthcare.epcr.fhir.mapper;

import com.healthcare.epcr.epcr.dto.PatientCareRecordDTO;

import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Maps ePCR records into a standard pan-Canadian FHIR R4 Patient Summary (PS-CA) Document Bundle.
 * Reference: https://build.fhir.org/document.html
 */
public class FhirSummaryDocumentMapper {

    private FhirSummaryDocumentMapper() {}

    public static Map<String, Object> toPatientSummary(PatientCareRecordDTO record) {
        Map<String, Object> bundle = new LinkedHashMap<>();
        bundle.put("resourceType", "Bundle");
        String bundleId = record.getId() != null ? record.getId() : UUID.randomUUID().toString();
        bundle.put("id", bundleId + "-summary-bundle");
        bundle.put("type", "document");
        bundle.put("timestamp", DateTimeFormatter.ISO_INSTANT.format(Instant.now()));

        List<Map<String, Object>> entries = new ArrayList<>();
        bundle.put("entry", entries);

        // ── 1. Create Core Resources ──────────────────────────────────────────
        String patientId = record.getPatientId() != null ? record.getPatientId() : "PAT-UNKNOWN";
        String encounterId = record.getId() != null ? record.getId() : "ENC-UNKNOWN";

        // Patient Resource
        Map<String, Object> patient = FhirPatientMapper.toPatient(record);
        patient.put("id", patientId);

        // Encounter Resource
        Map<String, Object> encounter = FhirEncounterMapper.toEncounter(record);
        encounter.put("id", encounterId);

        // Observations (Vitals)
        List<Map<String, Object>> observations = new ArrayList<>();
        if (record.getStructuredVitals() != null) {
            for (int i = 0; i < record.getStructuredVitals().size(); i++) {
                String uid = encounterId + "-vital-" + i;
                observations.add(FhirObservationMapper.vitalSignsObservation(
                        record.getStructuredVitals().get(i), patientId, encounterId, uid));
            }
        }

        // Medication Administrations
        List<Map<String, Object>> medications = new ArrayList<>();
        if (record.getStructuredMedications() != null) {
            for (int i = 0; i < record.getStructuredMedications().size(); i++) {
                String uid = encounterId + "-med-" + i;
                medications.add(FhirMedicationAdminMapper.toMedicationAdministration(
                        record.getStructuredMedications().get(i), patientId, encounterId, uid));
            }
        }

        // Conditions
        List<Map<String, Object>> conditions = new ArrayList<>();
        if (record.getDiagnosis() != null || record.getIcd10Code() != null) {
            conditions.add(FhirConditionMapper.toCondition(
                    record.getIcd10Code(), record.getDiagnosis(),
                    patientId, encounterId, encounterId + "-cond-0"));
        }
        if (record.getSecondaryImpression() != null && !record.getSecondaryImpression().equals(record.getDiagnosis())) {
            conditions.add(FhirConditionMapper.toCondition(
                    null, record.getSecondaryImpression(),
                    patientId, encounterId, encounterId + "-cond-1"));
        }

        // Procedures
        List<Map<String, Object>> procedures = new ArrayList<>();
        if (record.getStructuredProcedures() != null) {
            for (int i = 0; i < record.getStructuredProcedures().size(); i++) {
                String uid = encounterId + "-proc-" + i;
                procedures.add(FhirProcedureMapper.toProcedure(
                        record.getStructuredProcedures().get(i), patientId, encounterId, uid));
            }
        }

        // ── 2. Create Composition Resource (First Entry) ──────────────────────
        Map<String, Object> composition = new LinkedHashMap<>();
        composition.put("resourceType", "Composition");
        composition.put("id", encounterId + "-summary-composition");
        composition.put("status", "final");
        
        // Type: Patient Summary Document
        composition.put("type", Map.of(
                "coding", List.of(Map.of(
                        "system", "http://loinc.org",
                        "code", "60591-5",
                        "display", "Patient Summary Document"
                ))
        ));

        // Subject: Reference to Patient
        composition.put("subject", Map.of("reference", "Patient/" + patientId));
        
        // Encounter: Reference to Encounter
        composition.put("encounter", Map.of("reference", "Encounter/" + encounterId));
        
        composition.put("date", DateTimeFormatter.ISO_INSTANT.format(Instant.now()));
        composition.put("title", "NWT Patient Summary (PS-CA) Document");
        composition.put("author", List.of(Map.of("display", "Healthcare ePCR System")));

        // Sections
        List<Map<String, Object>> sections = new ArrayList<>();
        
        // Vitals Section
        if (!observations.isEmpty()) {
            Map<String, Object> sec = new LinkedHashMap<>();
            sec.put("title", "Vital Signs");
            sec.put("code", Map.of("coding", List.of(Map.of("system", "http://loinc.org", "code", "8716-3", "display", "Vital signs"))));
            List<Map<String, String>> refs = new ArrayList<>();
            for (Map<String, Object> obs : observations) {
                refs.add(Map.of("reference", "Observation/" + obs.get("id")));
            }
            sec.put("entry", refs);
            sections.add(sec);
        }

        // Medications Section
        if (!medications.isEmpty()) {
            Map<String, Object> sec = new LinkedHashMap<>();
            sec.put("title", "Medications");
            sec.put("code", Map.of("coding", List.of(Map.of("system", "http://loinc.org", "code", "10160-0", "display", "History of Medication use"))));
            List<Map<String, String>> refs = new ArrayList<>();
            for (Map<String, Object> med : medications) {
                refs.add(Map.of("reference", "MedicationAdministration/" + med.get("id")));
            }
            sec.put("entry", refs);
            sections.add(sec);
        }

        // Problems Section
        if (!conditions.isEmpty()) {
            Map<String, Object> sec = new LinkedHashMap<>();
            sec.put("title", "Active Problems");
            sec.put("code", Map.of("coding", List.of(Map.of("system", "http://loinc.org", "code", "11450-4", "display", "Problem list"))));
            List<Map<String, String>> refs = new ArrayList<>();
            for (Map<String, Object> cond : conditions) {
                refs.add(Map.of("reference", "Condition/" + cond.get("id")));
            }
            sec.put("entry", refs);
            sections.add(sec);
        }

        // Procedures Section
        if (!procedures.isEmpty()) {
            Map<String, Object> sec = new LinkedHashMap<>();
            sec.put("title", "Procedures");
            sec.put("code", Map.of("coding", List.of(Map.of("system", "http://loinc.org", "code", "47519-4", "display", "History of Procedures"))));
            List<Map<String, String>> refs = new ArrayList<>();
            for (Map<String, Object> proc : procedures) {
                refs.add(Map.of("reference", "Procedure/" + proc.get("id")));
            }
            sec.put("entry", refs);
            sections.add(sec);
        }

        composition.put("section", sections);

        // ── 3. Assemble Bundle Entries ────────────────────────────────────────
        // First entry MUST be the Composition resource
        entries.add(Map.of(
                "fullUrl", "urn:uuid:" + composition.get("id"),
                "resource", composition
        ));

        // Add Patient
        entries.add(Map.of(
                "fullUrl", "urn:uuid:" + patient.get("id"),
                "resource", patient
        ));

        // Add Encounter
        entries.add(Map.of(
                "fullUrl", "urn:uuid:" + encounter.get("id"),
                "resource", encounter
        ));

        // Add all Vitals
        for (Map<String, Object> obs : observations) {
            entries.add(Map.of(
                    "fullUrl", "urn:uuid:" + obs.get("id"),
                    "resource", obs
            ));
        }

        // Add all Medications
        for (Map<String, Object> med : medications) {
            entries.add(Map.of(
                    "fullUrl", "urn:uuid:" + med.get("id"),
                    "resource", med
            ));
        }

        // Add all Conditions
        for (Map<String, Object> cond : conditions) {
            entries.add(Map.of(
                    "fullUrl", "urn:uuid:" + cond.get("id"),
                    "resource", cond
            ));
        }

        // Add all Procedures
        for (Map<String, Object> proc : procedures) {
            entries.add(Map.of(
                    "fullUrl", "urn:uuid:" + proc.get("id"),
                    "resource", proc
            ));
        }

        return bundle;
    }
}
