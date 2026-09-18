package com.healthcare.epcr.fhir.mapper;

import com.healthcare.epcr.epcr.model.VitalSigns;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Maps ePCR VitalSigns snapshots into FHIR R4 Observation resources (vital-signs category).
 * Each VitalSigns object → one Observation with multiple components (LOINC codes).
 * Reference: https://www.hl7.org/fhir/observation.html
 */
public class FhirObservationMapper {

    private FhirObservationMapper() {}

    /**
     * @param v          VitalSigns snapshot (embedded in PatientCareRecord)
     * @param patientId  ePCR patient ID (used as subject reference)
     * @param encounterId ePCR record ID (used as encounter reference)
     * @param uniqueId   deterministic ID, e.g. "{recordId}-vital-{index}"
     */
    public static Map<String, Object> vitalSignsObservation(
            VitalSigns v, String patientId, String encounterId, String uniqueId) {

        Map<String, Object> obs = new LinkedHashMap<>();
        obs.put("resourceType", "Observation");
        obs.put("id", uniqueId);
        obs.put("status", "final");

        // Category: vital-signs
        obs.put("category", List.of(Map.of(
            "coding", List.of(Map.of(
                "system", "http://terminology.hl7.org/CodeSystem/observation-category",
                "code", "vital-signs",
                "display", "Vital Signs"
            ))
        )));

        // Code: panel
        obs.put("code", Map.of(
            "coding", List.of(Map.of(
                "system", "http://loinc.org",
                "code", "85353-1",
                "display", "Vital signs, weight, height, head circumference, oxygen saturation & BMI panel"
            ))
        ));

        obs.put("subject", Map.of("reference", "Patient/" + patientId));
        obs.put("encounter", Map.of("reference", "Encounter/" + encounterId));

        if (v.getRecordedAt() != null) {
            obs.put("effectiveDateTime", v.getRecordedAt().toString());
        }
        if (v.getRecordedBy() != null) {
            obs.put("performer", List.of(Map.of("display", v.getRecordedBy())));
        }
        if (v.getVitalPhase() != null) {
            obs.put("note", List.of(Map.of("text", "Phase: " + v.getVitalPhase())));
        }

        // ── Components (individual vital measurements) ────────────────────────
        List<Map<String, Object>> components = new ArrayList<>();

        addIntComponent(components, "8867-4",  "Heart rate",        v.getHeartRate(),        "/min");
        addIntComponent(components, "8893-0",  "Pulse rate",        v.getPulseRate(),         "/min");
        addIntComponent(components, "59408-5", "Oxygen saturation", v.getOxygenSaturation(),  "%");
        addIntComponent(components, "8480-6",  "Systolic BP",       v.getSystolicBP(),        "mm[Hg]");
        addIntComponent(components, "8462-4",  "Diastolic BP",      v.getDiastolicBP(),       "mm[Hg]");
        addIntComponent(components, "9279-1",  "Respiratory rate",  v.getRespiratoryRate(),   "/min");
        addDoubleComponent(components, "8310-5", "Body temperature", v.getTemperature(),      "Cel");
        addDoubleComponent(components, "59262-6", "Hemoglobin",      v.getHemoglobin(),       "g/dL");
        addIntComponent(components, "9269-2",  "Glasgow coma score", v.getGlasgowComaScale(), "{score}");
        addIntComponent(components, "38208-5", "Pain score",        v.getPainScore(),          "{score}");
        addDoubleComponent(components, "15074-8", "Blood glucose",  v.getBloodGlucose(),      "mg/dL");

        // String-valued observations
        if (v.getMentalStatus() != null) {
            components.add(codedStringComponent("67775-7", "Level of consciousness", v.getMentalStatus()));
        }
        if (v.getSkinColor() != null) {
            components.add(codedStringComponent("39106-0", "Skin color", v.getSkinColor()));
        }
        if (v.getAvpu() != null) {
            components.add(codedStringComponent("67775-7", "AVPU", v.getAvpu()));
        }

        obs.put("component", components);
        return obs;
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private static void addIntComponent(List<Map<String, Object>> list,
            String loinc, String display, Integer value, String unit) {
        if (value == null) return;
        list.add(Map.of(
            "code", Map.of("coding", List.of(Map.of(
                "system", "http://loinc.org", "code", loinc, "display", display))),
            "valueQuantity", Map.of(
                "value", value, "unit", unit, "system", "http://unitsofmeasure.org", "code", unit)
        ));
    }

    private static void addDoubleComponent(List<Map<String, Object>> list,
            String loinc, String display, Double value, String unit) {
        if (value == null) return;
        list.add(Map.of(
            "code", Map.of("coding", List.of(Map.of(
                "system", "http://loinc.org", "code", loinc, "display", display))),
            "valueQuantity", Map.of(
                "value", value, "unit", unit, "system", "http://unitsofmeasure.org", "code", unit)
        ));
    }

    private static Map<String, Object> codedStringComponent(String loinc, String display, String value) {
        return Map.of(
            "code", Map.of("coding", List.of(Map.of(
                "system", "http://loinc.org", "code", loinc, "display", display))),
            "valueString", value
        );
    }
}
