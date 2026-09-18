package com.healthcare.epcr.fhir.mapper;

import com.healthcare.epcr.surgical.model.AnesthesiaRecord;
import com.healthcare.epcr.surgical.model.SurgicalCase;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * FhirSurgicalMapper — maps Surgical Care domain objects to FHIR R4 resources.
 *
 * Mappings:
 *   SurgicalCase       → FHIR R4 Procedure
 *   AnesthesiaRecord   → FHIR R4 Procedure (anesthesia procedure)
 *   VitalsEntry        → FHIR R4 Observation (reuses pattern from FhirObservationMapper)
 *
 * Reference: https://www.hl7.org/fhir/procedure.html
 * Reference: https://www.hl7.org/fhir/observation.html
 */
public class FhirSurgicalMapper {

    private FhirSurgicalMapper() {}

    // ─────────────────────────────────────────────────────────────────────────
    //  SurgicalCase → FHIR Procedure
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Maps a SurgicalCase to a FHIR R4 Procedure resource.
     *
     * Status mapping:
     *   SCHEDULED / CHECKED_IN / PRE_OP_VERIFIED → "preparation"
     *   IN_PROGRESS                               → "in-progress"
     *   RECOVERY / COMPLETED                      → "completed"
     *   CANCELLED                                 → "not-done"
     */
    public static Map<String, Object> toProcedure(SurgicalCase sc) {
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("resourceType", "Procedure");
        res.put("id", "surgical-case-" + sc.getId());

        // ── Meta ─────────────────────────────────────────────────────────────
        res.put("meta", Map.of(
            "profile", List.of("http://hl7.org/fhir/StructureDefinition/Procedure")
        ));

        // ── Identifiers ───────────────────────────────────────────────────────
        res.put("identifier", List.of(Map.of(
            "system", "urn:innovia:surgical-case",
            "value",  sc.getCaseNumber()
        )));

        // ── Status ────────────────────────────────────────────────────────────
        res.put("status", mapCaseStatus(sc.getStatus() != null ? sc.getStatus().name() : "SCHEDULED"));

        // ── Category (surgical procedure) ────────────────────────────────────
        res.put("category", Map.of(
            "coding", List.of(Map.of(
                "system",  "http://snomed.info/sct",
                "code",    "387713003",
                "display", "Surgical procedure"
            ))
        ));

        // ── Code (SNOMED if available) ────────────────────────────────────────
        String procName = sc.getProcedureName() != null ? sc.getProcedureName() : "Surgical Procedure";
        if (sc.getSnomedCode() != null && !sc.getSnomedCode().isBlank()) {
            res.put("code", Map.of(
                "coding", List.of(Map.of(
                    "system",  "http://snomed.info/sct",
                    "code",    sc.getSnomedCode(),
                    "display", procName
                )),
                "text", procName
            ));
        } else {
            res.put("code", Map.of("text", procName));
        }

        // ── Subject ───────────────────────────────────────────────────────────
        res.put("subject", Map.of("reference", "Patient/" + sc.getPatientId()));

        // ── Performed period ──────────────────────────────────────────────────
        Instant periodStart = sc.getActualStart() != null ? sc.getActualStart() : sc.getScheduledStart();
        if (periodStart != null) {
            Map<String, Object> period = new LinkedHashMap<>();
            period.put("start", periodStart.toString());
            Instant periodEnd = sc.getActualEnd() != null ? sc.getActualEnd() : sc.getScheduledEnd();
            if (periodEnd != null) period.put("end", periodEnd.toString());
            res.put("performedPeriod", period);
        }

        // ── Performers ────────────────────────────────────────────────────────
        List<Map<String, Object>> performers = new ArrayList<>();
        if (sc.getSurgeonName() != null) {
            performers.add(Map.of(
                "function", Map.of(
                    "coding", List.of(Map.of(
                        "system",  "http://snomed.info/sct",
                        "code",    "304292004",
                        "display", "Surgeon"
                    ))
                ),
                "actor", Map.of("display", sc.getSurgeonName())
            ));
        }
        if (sc.getAnesthesiologistName() != null) {
            performers.add(Map.of(
                "function", Map.of(
                    "coding", List.of(Map.of(
                        "system",  "http://snomed.info/sct",
                        "code",    "88189002",
                        "display", "Anesthesiologist"
                    ))
                ),
                "actor", Map.of("display", sc.getAnesthesiologistName())
            ));
        }
        if (!performers.isEmpty()) res.put("performer", performers);

        // ── Location (OR) ─────────────────────────────────────────────────────
        if (sc.getOrName() != null) {
            res.put("location", Map.of("display", sc.getOrName()));
        }

        // ── Extension: urgency ────────────────────────────────────────────────
        if (sc.getUrgency() != null) {
            res.put("extension", List.of(Map.of(
                "url",         "http://innovia.health/fhir/extension/surgical-urgency",
                "valueString", sc.getUrgency().name()
            )));
        }

        return res;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  AnesthesiaRecord VitalsEntry → FHIR Observation
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Maps a single VitalsEntry from an AnesthesiaRecord to a FHIR Observation bundle entry.
     * Follows the pattern established in FhirObservationMapper.
     */
    public static Map<String, Object> vitalsToObservation(
            AnesthesiaRecord.VitalsEntry vitals, String patientId, String caseId, int index) {

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("resourceType", "Observation");
        res.put("id", "anesthesia-vitals-" + caseId + "-" + index);
        res.put("status", "final");

        res.put("category", List.of(Map.of(
            "coding", List.of(Map.of(
                "system",  "http://terminology.hl7.org/CodeSystem/observation-category",
                "code",    "vital-signs",
                "display", "Vital Signs"
            ))
        )));

        res.put("code", Map.of(
            "coding", List.of(Map.of(
                "system",  "http://loinc.org",
                "code",    "74728-7",
                "display", "Vital signs, weight, height, head circumference, oxygen saturation and BMI panel"
            )),
            "text", "Intra-operative vitals"
        ));

        res.put("subject", Map.of("reference", "Patient/" + patientId));
        res.put("focus",   List.of(Map.of("reference", "Procedure/surgical-case-" + caseId)));

        if (vitals.getTime() != null) {
            res.put("effectiveDateTime", vitals.getTime().toString());
        }

        // Compose component array for multi-value vitals
        List<Map<String, Object>> components = new ArrayList<>();

        if (vitals.getHr() != null) {
            components.add(buildComponent("8867-4", "Heart rate", vitals.getHr(), "bpm"));
        }
        if (vitals.getSpo2() != null) {
            components.add(buildComponent("59408-5", "Oxygen saturation", vitals.getSpo2(), "%"));
        }
        if (vitals.getEtco2() != null) {
            components.add(buildComponent("19889-5", "End tidal CO2", vitals.getEtco2(), "mmHg"));
        }
        if (vitals.getTemp() != null) {
            components.add(buildComponent("8310-5", "Body temperature", vitals.getTemp(), "Cel"));
        }
        if (vitals.getBp() != null && !vitals.getBp().isBlank()) {
            components.add(Map.of(
                "code", Map.of("coding", List.of(Map.of(
                    "system", "http://loinc.org",
                    "code",   "55284-4",
                    "display","Blood pressure systolic and diastolic"
                ))),
                "valueString", vitals.getBp()
            ));
        }
        if (!components.isEmpty()) res.put("component", components);

        return res;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Composite Bundle: SurgicalCase + AnesthesiaRecord
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Builds a FHIR Bundle containing:
     *  - The Procedure resource (surgical case)
     *  - Observation resources (one per vitals entry)
     *  - Anesthesia procedure note
     */
    public static Map<String, Object> toAnesthesiaBundle(SurgicalCase sc, AnesthesiaRecord rec) {
        Map<String, Object> bundle = new LinkedHashMap<>();
        bundle.put("resourceType", "Bundle");
        bundle.put("id", "anesthesia-report-" + sc.getId());
        bundle.put("type", "collection");

        List<Map<String, Object>> entries = new ArrayList<>();

        // Main procedure entry
        entries.add(Map.of("resource", toProcedure(sc)));

        // Vitals observations
        if (rec != null && rec.getVitalsTimeline() != null) {
            for (int i = 0; i < rec.getVitalsTimeline().size(); i++) {
                entries.add(Map.of("resource",
                        vitalsToObservation(rec.getVitalsTimeline().get(i), sc.getPatientId(), sc.getId(), i)));
            }
        }

        bundle.put("entry", entries);
        return bundle;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  PRIVATE HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    private static String mapCaseStatus(String status) {
        return switch (status) {
            case "SCHEDULED", "CHECKED_IN", "PRE_OP_VERIFIED" -> "preparation";
            case "IN_PROGRESS"                                 -> "in-progress";
            case "RECOVERY", "COMPLETED"                       -> "completed";
            case "CANCELLED"                                   -> "not-done";
            default                                            -> "unknown";
        };
    }

    private static Map<String, Object> buildComponent(String loincCode, String display,
                                                       Number value, String unit) {
        return Map.of(
            "code", Map.of("coding", List.of(Map.of(
                "system", "http://loinc.org",
                "code",   loincCode,
                "display", display
            ))),
            "valueQuantity", Map.of(
                "value",  value,
                "unit",   unit,
                "system", "http://unitsofmeasure.org",
                "code",   unit
            )
        );
    }

}

