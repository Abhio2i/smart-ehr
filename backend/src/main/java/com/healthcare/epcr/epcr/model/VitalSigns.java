package com.healthcare.epcr.epcr.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class VitalSigns {
    private String treatmentPhase;
    private String vitalPhase;
    private LocalDateTime recordedAt;
    private Integer heartRate;
    private Integer pulseRate;
    private Integer systolicBP;
    private Integer diastolicBP;
    private Integer respiratoryRate;
    private Integer oxygenSaturation;
    private String oxygenDeliveryMethod;
    private Double temperature;
    private String temperatureRoute;
    private Double hemoglobin;
    private Integer glasgowComaScale;
    private String mentalStatus;
    private Integer gcEye;
    private Integer gcVerbal;
    private Integer gcMotor;
    private String avpu;
    private Integer painScore;
    private String painLocation;
    private Double bloodGlucose;
    private String skinColor;
    private String skinCondition;
    private String skinTemperature;
    private String pupilLeft;
    private String pupilRight;
    private Boolean pupilsEqual;
    private Boolean pupilsReactive;
    private String recordedBy;

    public VitalSigns(LocalDateTime recordedAt, Integer heartRate, Integer systolicBP, Integer diastolicBP,
                      Integer respiratoryRate, Integer oxygenSaturation, String oxygenDeliveryMethod,
                      Double temperature, String temperatureRoute, Integer glasgowComaScale, Integer gcEye,
                      Integer gcVerbal, Integer gcMotor, String avpu, Integer painScore, String painLocation,
                      Double bloodGlucose, String skinColor, String skinCondition, String skinTemperature,
                      String pupilLeft, String pupilRight, Boolean pupilsEqual, Boolean pupilsReactive,
                      String recordedBy) {
        this(null, null, recordedAt, heartRate, null, systolicBP, diastolicBP, respiratoryRate, oxygenSaturation,
                oxygenDeliveryMethod, temperature, temperatureRoute, null, glasgowComaScale, null, gcEye, gcVerbal,
                gcMotor, avpu, painScore, painLocation, bloodGlucose, skinColor, skinCondition, skinTemperature,
                pupilLeft, pupilRight, pupilsEqual, pupilsReactive, recordedBy);
    }
}
