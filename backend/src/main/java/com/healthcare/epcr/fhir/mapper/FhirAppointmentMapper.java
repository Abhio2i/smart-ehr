package com.healthcare.epcr.fhir.mapper;

import com.healthcare.epcr.scheduling.model.Appointment;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Maps Scheduling Appointment fields into a FHIR R4 Appointment resource.
 * Reference: https://www.hl7.org/fhir/appointment.html
 */
public class FhirAppointmentMapper {

    private FhirAppointmentMapper() {}

    public static Map<String, Object> toFhir(Appointment appt) {
        Map<String, Object> fhir = new LinkedHashMap<>();
        fhir.put("resourceType", "Appointment");
        fhir.put("id", appt.getId());
        
        // Map status: scheduled, confirmed, completed, cancelled, no-show
        String status = "proposed";
        if (appt.getStatus() != null) {
            status = switch (appt.getStatus().toUpperCase()) {
                case "SCHEDULED" -> "booked";
                case "CONFIRMED" -> "booked";
                case "COMPLETED" -> "fulfilled";
                case "CANCELLED" -> "cancelled";
                case "NO_SHOW"   -> "noshow";
                default          -> "proposed";
            };
        }
        fhir.put("status", status);
        
        if (appt.getReasonForVisit() != null) {
            fhir.put("description", appt.getReasonForVisit());
        }
        
        if (appt.getScheduledStart() != null) {
            fhir.put("start", appt.getScheduledStart().toString());
        }
        
        if (appt.getScheduledEnd() != null) {
            fhir.put("end", appt.getScheduledEnd().toString());
        }

        fhir.put("participant", List.of(
            Map.of("actor", Map.of("reference", "Patient/" + appt.getPatientId()), "status", "accepted"),
            Map.of("actor", Map.of("reference", "Practitioner/" + appt.getProviderId()), "status", "accepted")
        ));
        
        return fhir;
    }
}
