package com.healthcare.epcr.patient.dto;

import com.healthcare.epcr.epcr.enums.PatientGender;
import com.healthcare.epcr.epcr.model.MedicalHistory;
import com.healthcare.epcr.patienthistory.enums.PatientOverviewType;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PatientSearchResultDTO {
    private String id;
    private String patientId;
    private String organizationId;
    private String displayName;
    private String dateOfBirth;
    private PatientGender gender;
    private String phone;
    private String email;
    private String ssnLast4;
    private String patientName;
    private String patientDateOfBirth;
    private PatientGender patientGender;
    private String patientPhone;
    private String patientAddress;
    private String patientSSNLast4;
    private MedicalHistory medicalHistory;
    private Integer age;
    private String bloodGroup;
    private Double height;
    private Double weight;
    private Double spo2;
    private Integer respirationRate;
    private Double bloodSugar;
    private Integer heartRate;
    private Integer diastolicBp;
    private Integer systolicBp;
    private Integer pulseRate;
    private Double temperature;
    private Double hemoglobin;
    private String comorbidity;
    private String allergy;
    private String doctor;
    private String currentMedicines;
    private String latestRecordId;
    private String latestIncidentType;
    private PatientOverviewType overviewType;
    private String frontendRouteKey;
    private boolean active;
}
