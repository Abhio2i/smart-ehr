package com.healthcare.epcr.fhir.mapper;

import com.healthcare.epcr.epcr.dto.PatientCareRecordDTO;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Maps ePCR record (incident) data into a FHIR R4 Encounter resource.
 * Reference: https://www.hl7.org/fhir/encounter.html
 */
public class FhirEncounterMapper {

    private FhirEncounterMapper() {}

    public static Map<String, Object> toEncounter(PatientCareRecordDTO record) {
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("resourceType", "Encounter");
        res.put("id", record.getId());

        // ── Status ────────────────────────────────────────────────────────────
        String fhirStatus = switch (record.getStatus() != null ? record.getStatus().toUpperCase() : "") {
            case "SUBMITTED", "QA_APPROVED" -> "finished";
            case "DRAFT", "DRAFT_OFFLINE"   -> "in-progress";
            default                          -> "unknown";
        };
        res.put("status", fhirStatus);

        // ── Class — EMS / Emergency ───────────────────────────────────────────
        res.put("class", Map.of(
            "system", "http://terminology.hl7.org/CodeSystem/v3-ActCode",
            "code", "EMER",
            "display", "emergency"
        ));

        // ── Type — incident type ───────────────────────────────────────────────
        if (record.getIncidentType() != null) {
            res.put("type", List.of(Map.of(
                "text", record.getIncidentType()
            )));
        }

        // ── Subject (Patient reference) ────────────────────────────────────────
        res.put("subject", Map.of("reference", "Patient/" + record.getPatientId()));

        // ── Participant (Paramedic) ────────────────────────────────────────────
        if (record.getParamedicsId() != null) {
            List<Map<String, Object>> participants = new ArrayList<>();
            Map<String, Object> participant = new LinkedHashMap<>();
            participant.put("type", List.of(Map.of(
                "coding", List.of(Map.of(
                    "system", "http://terminology.hl7.org/CodeSystem/v3-ParticipationType",
                    "code", "PART"
                ))
            )));
            participant.put("individual", Map.of(
                "reference", "Practitioner/" + record.getParamedicsId(),
                "display", record.getParamedicsName() != null ? record.getParamedicsName() : "Paramedic"
            ));
            participants.add(participant);
            res.put("participant", participants);
        }

        // ── Period ─────────────────────────────────────────────────────────────
        if (record.getIncidentDateTime() != null) {
            Map<String, Object> period = new LinkedHashMap<>();
            period.put("start", record.getIncidentDateTime().toString());
            if (record.getSubmittedAt() != null) {
                period.put("end", record.getSubmittedAt().toString());
            }
            res.put("period", period);
        }

        // ── Reason (chief complaint/primary impression) ────────────────────────
        if (record.getPrimaryImpression() != null) {
            res.put("reasonCode", List.of(Map.of("text", record.getPrimaryImpression())));
        }

        // ── Location ─────────────────────────────────────────────────────────
        if (record.getIncidentLocation() != null) {
            res.put("location", List.of(Map.of(
                "location", Map.of("display", record.getIncidentLocation())
            )));
        }

        // ── Service Provider (organization) ───────────────────────────────────
        if (record.getOrganizationId() != null) {
            res.put("serviceProvider", Map.of(
                "reference", "Organization/" + record.getOrganizationId(),
                "display", record.getOrganizationName() != null ? record.getOrganizationName() : ""
            ));
        }

        return res;
    }
}
