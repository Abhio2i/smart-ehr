package com.healthcare.epcr.patienthistory.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "patient_vitals")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PatientVital {
    @Id
    private String id;
    @Indexed
    private String patientId;
    @Indexed
    private String organizationId;
    private String recordedBy;
    private String recordedByName;
    @Indexed
    private LocalDateTime recordedAt;
    @Indexed
    private String linkedEpcrId;
    private String linkedEncounterId;

    private Integer systolicBP;
    private Integer diastolicBP;
    private Integer heartRate;
    private Integer pulseRate;
    private Double oxygenSaturation;
    private Integer respiratoryRate;
    private String oxygenDeliveryMethod;

    private Integer glasgowComaScale;
    private Integer gcEye;
    private Integer gcVerbal;
    private Integer gcMotor;
    private String avpu;
    private Integer painScore;
    private String painLocation;

    private Double temperature;
    private String temperatureRoute;
    private Double bloodGlucose;
    private Double hemoglobin;

    private String pupilLeft;
    private String pupilRight;
    private Boolean pupilsEqual;
    private Boolean pupilsReactive;
    private String skinColor;
    private String skinCondition;
    private String skinTemperature;

    private String notes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
