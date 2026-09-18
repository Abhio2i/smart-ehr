package com.healthcare.epcr.epcr.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MedicalHistory {
    private List<String> pastConditions;
    private List<String> currentMedications;
    private List<String> allergies;
    private List<String> surgicalHistory;
    private Boolean dnrOnFile;
    private Boolean advanceDirective;
    private String advanceDirectiveType;
    private String primaryPhysicianName;
    private String primaryPhysicianContact;
    private String primaryPhysicianFacility;
    private Boolean smoker;
    private Boolean alcoholUse;
    private Boolean substanceUse;
    private String substanceUseDetails;
    private Boolean pregnant;
    private Integer gestationalWeekIfPregnant;
    private String lastKnownWellDateTime;
    private String lastOralIntake;
    private List<String> notes;

    public MedicalHistory(List<String> pastConditions, List<String> currentMedications, List<String> allergies,
                          List<String> surgicalHistory, Boolean dnrOnFile, Boolean advanceDirective,
                          String advanceDirectiveType, String primaryPhysicianName,
                          String primaryPhysicianContact, String primaryPhysicianFacility, Boolean smoker,
                          Boolean alcoholUse, Boolean substanceUse, String substanceUseDetails, Boolean pregnant,
                          Integer gestationalWeekIfPregnant, String lastKnownWellDateTime, String lastOralIntake) {
        this(pastConditions, currentMedications, allergies, surgicalHistory, dnrOnFile, advanceDirective,
                advanceDirectiveType, primaryPhysicianName, primaryPhysicianContact, primaryPhysicianFacility,
                smoker, alcoholUse, substanceUse, substanceUseDetails, pregnant, gestationalWeekIfPregnant,
                lastKnownWellDateTime, lastOralIntake, null);
    }
}
