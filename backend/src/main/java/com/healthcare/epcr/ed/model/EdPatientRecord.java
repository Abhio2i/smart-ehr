package com.healthcare.epcr.ed.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * Real-time Emergency Department (ED) Tracking & CTAS Acuity Patient Model.
 */
@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "ed_patient_records")
public class EdPatientRecord {

    @Id
    private String id;

    @Indexed
    private String organizationId;

    private String patientId;
    private String patientName;
    private Integer age;
    private String gender;
    private String chiefComplaint;

    /** CTAS Acuity Level (1: Resuscitation, 2: Emergent, 3: Urgent, 4: Less Urgent, 5: Non-Urgent). */
    private Integer ctasLevel;
    private String ctasName;

    /** ED Zone & Bed (e.g., Resuscitation Bay, Trauma Bay, Fast Track, Waiting Room). */
    private String edZone;
    private String bedNumber;

    private String assignedDoctor;
    private String assignedNurse;

    private LocalDateTime arrivalTime;
    private LocalDateTime triageTime;

    // Latest Vitals
    private Integer systolicBp;
    private Integer diastolicBp;
    private Integer pulseRate;
    private Integer respirationRate;
    private Double temperature;
    private Double spo2;

    /** Status: TRIAGED, IN_TREATMENT, AWAITING_RESULTS, DISPOSITION_READY, ADMITTED, DISCHARGED, TRANSFERRED, LWBS */
    private String status;

    /** Left Without Being Seen (LWBS) Flag */
    private Boolean lwbs;

    private String dispositionType; // ADMIT_ICU, ADMIT_WARD, DISCHARGE_HOME, TRANSFER_REGIONAL, LWBS
    private String dispositionNotes;
    private LocalDateTime dispositionTime;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
