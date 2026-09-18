package com.healthcare.epcr.fhir.mapper;

import com.healthcare.epcr.epcr.model.ProcedurePerformed;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Maps ePCR ProcedurePerformed entries into FHIR R4 Procedure resources.
 * Reference: https://www.hl7.org/fhir/procedure.html
 */
public class FhirProcedureMapper {

    private FhirProcedureMapper() {}

    /**
     * @param proc        ProcedurePerformed object (structured procedure from ePCR)
     * @param patientId   ePCR patient ID
     * @param encounterId ePCR record ID
     * @param uniqueId    deterministic ID, e.g. "{recordId}-proc-{index}"
     */
    public static Map<String, Object> toProcedure(
            ProcedurePerformed proc, String patientId, String encounterId, String uniqueId) {

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("resourceType", "Procedure");
        res.put("id", uniqueId);

        // ── Status ────────────────────────────────────────────────────────────
        String status = (proc.getSuccessful() != null && proc.getSuccessful()) ? "completed" : "stopped";
        res.put("status", status);

        // ── Code (SNOMED-CT if available, else text) ──────────────────────────
        String procName = proc.getProcedureName() != null ? proc.getProcedureName() : "Procedure";
        if (proc.getSnomedCode() != null && !proc.getSnomedCode().isBlank()) {
            res.put("code", Map.of(
                "coding", List.of(Map.of(
                    "system",  "http://snomed.info/sct",
                    "code",    proc.getSnomedCode(),
                    "display", procName
                )),
                "text", procName
            ));
        } else {
            res.put("code", Map.of("text", procName));
        }

        // ── Subject & Encounter ───────────────────────────────────────────────
        res.put("subject",   Map.of("reference", "Patient/"   + patientId));
        res.put("encounter", Map.of("reference", "Encounter/" + encounterId));

        // ── Performed time ────────────────────────────────────────────────────
        if (proc.getPerformedAt() != null) {
            res.put("performedDateTime", proc.getPerformedAt().toString());
        }

        // ── Performer ────────────────────────────────────────────────────────
        if (proc.getPerformedBy() != null) {
            res.put("performer", List.of(Map.of(
                "actor", Map.of("display", proc.getPerformedBy())
            )));
        }

        // ── Body site ────────────────────────────────────────────────────────
        if (proc.getBodysite() != null) {
            res.put("bodySite", List.of(Map.of("text", proc.getBodysite())));
        }

        // ── Complications ─────────────────────────────────────────────────────
        if (proc.getComplications() != null) {
            res.put("complication", List.of(Map.of("text", proc.getComplications())));
        }

        // ── Notes ─────────────────────────────────────────────────────────────
        if (proc.getPatientResponse() != null || proc.getNotes() != null) {
            StringBuilder note = new StringBuilder();
            if (proc.getPatientResponse() != null) note.append("Patient response: ").append(proc.getPatientResponse()).append(". ");
            if (proc.getNotes() != null) note.append(proc.getNotes());
            res.put("note", List.of(Map.of("text", note.toString().trim())));
        }

        return res;
    }
}
