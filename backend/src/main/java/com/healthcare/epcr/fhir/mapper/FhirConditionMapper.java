package com.healthcare.epcr.fhir.mapper;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Maps ePCR diagnosis / impression codes into FHIR R4 Condition resources.
 * Reference: https://www.hl7.org/fhir/condition.html
 */
public class FhirConditionMapper {

    private FhirConditionMapper() {}

    /**
     * @param icd10Code   ICD-10 code string (may be null — defaults to R69 "Illness, unspecified")
     * @param description Diagnosis text / primary impression
     * @param patientId   ePCR patient ID
     * @param encounterId ePCR record ID
     * @param uniqueId    deterministic ID, e.g. "{recordId}-cond-{index}"
     */
    public static Map<String, Object> toCondition(
            String icd10Code, String description,
            String patientId, String encounterId,
            String uniqueId) {

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("resourceType", "Condition");
        res.put("id", uniqueId);

        // ── Clinical status ───────────────────────────────────────────────────
        res.put("clinicalStatus", Map.of(
            "coding", List.of(Map.of(
                "system", "http://terminology.hl7.org/CodeSystem/condition-clinical",
                "code",   "active",
                "display", "Active"
            ))
        ));

        // ── Verification status ───────────────────────────────────────────────
        res.put("verificationStatus", Map.of(
            "coding", List.of(Map.of(
                "system", "http://terminology.hl7.org/CodeSystem/condition-ver-status",
                "code",   "confirmed",
                "display", "Confirmed"
            ))
        ));

        // ── Category — encounter-diagnosis ────────────────────────────────────
        res.put("category", List.of(Map.of(
            "coding", List.of(Map.of(
                "system",  "http://terminology.hl7.org/CodeSystem/condition-category",
                "code",    "encounter-diagnosis",
                "display", "Encounter Diagnosis"
            ))
        )));

        // ── Code (ICD-10) ─────────────────────────────────────────────────────
        String code    = (icd10Code != null && !icd10Code.isBlank()) ? icd10Code : "R69";
        String display = (description != null && !description.isBlank()) ? description : "Illness, unspecified";
        res.put("code", Map.of(
            "coding", List.of(Map.of(
                "system",  "http://hl7.org/fhir/sid/icd-10",
                "code",    code,
                "display", display
            )),
            "text", display
        ));

        // ── Subject & Encounter ───────────────────────────────────────────────
        res.put("subject",   Map.of("reference", "Patient/"   + patientId));
        res.put("encounter", Map.of("reference", "Encounter/" + encounterId));

        return res;
    }
}
