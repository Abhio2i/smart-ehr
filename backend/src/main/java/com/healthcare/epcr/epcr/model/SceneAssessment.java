package com.healthcare.epcr.epcr.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SceneAssessment {
    private String sceneType;
    private Boolean sceneSafe;
    private String sceneHazards;
    private Boolean traumaCall;
    private String mechanismOfInjury;
    private String injuryLocation;
    private Integer numberOfPatients;
    private Boolean massCasualtyIncident;
    private String triageTag;
    private String weatherConditions;
    private String lightingConditions;
    private Boolean witnessPresent;
    private String witnessName;
    private String witnessContact;
    private Boolean bystanderCPRPerformed;
    private Boolean aedUsedByBystander;
    private String patientAccessDifficulty;
}
