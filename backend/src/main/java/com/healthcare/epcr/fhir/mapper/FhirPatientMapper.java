package com.healthcare.epcr.fhir.mapper;

import com.healthcare.epcr.epcr.dto.PatientCareRecordDTO;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Maps ePCR patient fields into a FHIR R4 Patient resource (raw Map).
 * Reference: https://www.hl7.org/fhir/patient.html
 */
public class FhirPatientMapper {

    private FhirPatientMapper() {}

    public static Map<String, Object> toPatient(PatientCareRecordDTO record) {
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("resourceType", "Patient");
        res.put("id", record.getPatientId());
        res.put("active", true);

        // ── Name ──────────────────────────────────────────────────────────────
        if (record.getPatientName() != null && !record.getPatientName().isBlank()) {
            String fullName = record.getPatientName().trim();
            String[] parts = fullName.split("\\s+", 2);
            Map<String, Object> nameMap = new HashMap<>();
            nameMap.put("use", "official");
            nameMap.put("text", fullName);
            if (parts.length > 1) {
                nameMap.put("family", parts[parts.length - 1]);
                nameMap.put("given", List.of(parts[0]));
            } else {
                nameMap.put("given", List.of(fullName));
            }
            res.put("name", List.of(nameMap));
        }

        // ── Telecom ───────────────────────────────────────────────────────────
        List<Map<String, Object>> telecoms = new ArrayList<>();
        if (record.getPatientPhone() != null && !record.getPatientPhone().isBlank()) {
            telecoms.add(Map.of("system", "phone", "value", record.getPatientPhone(), "use", "mobile"));
        }
        if (record.getEmail() != null && !record.getEmail().isBlank()) {
            telecoms.add(Map.of("system", "email", "value", record.getEmail()));
        }
        if (!telecoms.isEmpty()) {
            res.put("telecom", telecoms);
        }

        // ── Gender ────────────────────────────────────────────────────────────
        if (record.getPatientGender() != null) {
            String fhirGender = switch (record.getPatientGender().name().toUpperCase()) {
                case "MALE"    -> "male";
                case "FEMALE"  -> "female";
                case "OTHER"   -> "other";
                default        -> "unknown";
            };
            res.put("gender", fhirGender);
        }

        // ── Date of Birth ─────────────────────────────────────────────────────
        if (record.getPatientDateOfBirth() != null && !record.getPatientDateOfBirth().isBlank()) {
            res.put("birthDate", record.getPatientDateOfBirth());
        }

        // ── Address ───────────────────────────────────────────────────────────
        if (record.getPatientAddress() != null && !record.getPatientAddress().isBlank()) {
            res.put("address", List.of(Map.of("text", record.getPatientAddress(), "use", "home")));
        }

        // ── Blood Group (extension) ───────────────────────────────────────────
        if (record.getBloodGroup() != null && !record.getBloodGroup().isBlank()) {
            res.put("extension", List.of(Map.of(
                "url", "http://hl7.org/fhir/StructureDefinition/patient-bloodgroup",
                "valueString", record.getBloodGroup()
            )));
        }

        return res;
    }
}
