package com.healthcare.epcr.mentalhealth.dto;

import com.healthcare.epcr.mentalhealth.entity.MentalHealthCase;
import lombok.Data;

import java.util.List;

@Data
public class CreateMentalHealthCaseRequest {
    private String patientId;
    private String assignedFacilityId;
    private String assignedProviderId;
    private MentalHealthCase.AdmissionType admissionType;
    private MentalHealthCase.SuicideRiskLevel riskLevel;
    private String riskNotes;
    private String primarySubstance;
    private boolean onOpioidAgonistTherapy;
    private String fasdStatus;
    private List<String> goals;
    private List<String> copingMechanisms;
    private String crisisSafetyPlan;
    private boolean traditionalHealingIncluded;
    private String emergencyContact;
}
