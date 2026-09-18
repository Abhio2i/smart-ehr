package com.healthcare.epcr.fhir.mapper;

import com.healthcare.epcr.epcr.model.MedicationAdministered;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Maps ePCR MedicationAdministered entries into FHIR R4 MedicationAdministration resources.
 * Reference: https://www.hl7.org/fhir/medicationadministration.html
 */
public class FhirMedicationAdminMapper {

    private FhirMedicationAdminMapper() {}

    /**
     * @param med         MedicationAdministered object (structured medication from ePCR)
     * @param patientId   ePCR patient ID
     * @param encounterId ePCR record ID (used as context reference)
     * @param uniqueId    deterministic ID, e.g. "{recordId}-med-{index}"
     */
    public static Map<String, Object> toMedicationAdministration(
            MedicationAdministered med, String patientId, String encounterId, String uniqueId) {

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("resourceType", "MedicationAdministration");
        res.put("id", uniqueId);
        res.put("status", "completed");

        // ── Medication (RxNorm coding) ─────────────────────────────────────────
        String rxCode   = med.getRxNormCode() != null ? med.getRxNormCode() : "unknown";
        String medName  = med.getMedicationName() != null ? med.getMedicationName() : "Unknown medication";
        String brand    = med.getBrandName() != null ? " (" + med.getBrandName() + ")" : "";
        res.put("medicationCodeableConcept", Map.of(
            "coding", List.of(Map.of(
                "system",  "http://www.nlm.nih.gov/research/umls/rxnorm",
                "code",    rxCode,
                "display", medName
            )),
            "text", medName + brand
        ));

        // ── Subject & Context ─────────────────────────────────────────────────
        res.put("subject", Map.of("reference", "Patient/" + patientId));
        res.put("context", Map.of("reference", "Encounter/" + encounterId));

        // ── Effective time ────────────────────────────────────────────────────
        if (med.getAdministeredAt() != null) {
            res.put("effectiveDateTime", med.getAdministeredAt().toString());
        }

        // ── Performer ────────────────────────────────────────────────────────
        if (med.getAdministeredBy() != null) {
            res.put("performer", List.of(Map.of(
                "actor", Map.of("display", med.getAdministeredBy())
            )));
        }

        // ── Dosage ────────────────────────────────────────────────────────────
        Map<String, Object> dosage = new LinkedHashMap<>();
        if (med.getRoute() != null) {
            dosage.put("route", Map.of("text", med.getRoute()));
        }
        if (med.getDosage() != null) {
            dosage.put("dose", Map.of(
                "value",  med.getDosage(),
                "unit",   med.getUnit() != null ? med.getUnit() : "mg",
                "system", "http://unitsofmeasure.org"
            ));
        }
        if (!dosage.isEmpty()) {
            res.put("dosage", dosage);
        }

        // ── Notes / adverse reactions ─────────────────────────────────────────
        if (med.getPatientResponse() != null || med.getAdverseReactionDetails() != null) {
            StringBuilder note = new StringBuilder();
            if (med.getPatientResponse() != null) note.append("Response: ").append(med.getPatientResponse()).append(". ");
            if (med.getAdverseReactionDetails() != null) note.append("Adverse: ").append(med.getAdverseReactionDetails());
            res.put("note", List.of(Map.of("text", note.toString().trim())));
        }

        // ── Indication ────────────────────────────────────────────────────────
        if (med.getIndication() != null) {
            res.put("reasonCode", List.of(Map.of("text", med.getIndication())));
        }

        return res;
    }
}
