package com.healthcare.epcr.surgical.model;

import com.healthcare.epcr.surgical.enums.AnesthesiaType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * AnesthesiaRecord — complete intra-operative anesthesia log for a SurgicalCase.
 *
 * Contains:
 *  - Anesthesia type + ASA classification
 *  - Induction/emergence timestamps (for duration calculation)
 *  - Rolling vitals timeline (appended throughout the procedure)
 *  - Medications administered with dose/route/time
 *  - Airway management + complications notes
 *
 * FHIR mapping: vitalsTimeline entries → FHIR Observation resources
 */
@Document(collection = "anesthesiaRecords")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnesthesiaRecord {

    @Id
    private String id;

    @Indexed(unique = true)
    private String surgicalCaseId;

    private String anesthesiologistId;
    private String anesthesiologistName;

    private AnesthesiaType anesthesiaType;

    /**
     * ASA Physical Status Classification (1–6).
     * 1 = normal healthy patient, 6 = brain-dead organ donor.
     */
    private Integer asaClass;

    private Instant inductionTime;
    private Instant emergenceTime;

    /**
     * Rolling intra-operative vitals — appended during surgery.
     * Maps to FHIR Observation resources for interoperability.
     */
    @Builder.Default
    private List<VitalsEntry> vitalsTimeline = new ArrayList<>();

    /**
     * Medications administered during the case.
     */
    @Builder.Default
    private List<MedicationEntry> medicationsAdministered = new ArrayList<>();

    /** Airway management description (e.g. "LMA size 4", "RSI with video laryngoscope"). */
    private String airwayManagement;

    /** Intra-op complications (e.g. "Laryngospasm, managed with suxamethonium"). */
    private String complications;

    /** Free-text anesthesia notes. */
    private String notes;

    /** Whether the record is marked complete (locked for editing). */
    private boolean completed;

    private Instant createdAt;
    private Instant updatedAt;

    // ─────────────────────────────────────────────────────────────────────────
    //  Embedded Sub-Documents
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Single intra-operative vitals snapshot.
     * All numeric values are nullable (not all monitors always available).
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class VitalsEntry {
        private Instant time;
        /** Heart rate (bpm). */
        private Integer hr;
        /** Blood pressure as string, e.g. "120/80". */
        private String bp;
        /** SpO2 percentage (e.g. 98). */
        private Integer spo2;
        /** End-tidal CO2 (mmHg). */
        private Integer etco2;
        /** Temperature in Celsius. */
        private Double temp;
    }

    /**
     * Single medication administration event.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MedicationEntry {
        private String drug;
        private String dose;
        private String route; // IV, IM, INHALED, ORAL
        private Instant time;
    }
}
