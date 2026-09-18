package com.healthcare.epcr.patienthistory.dto;

import com.healthcare.epcr.patienthistory.model.PatientAdmission;
import com.healthcare.epcr.patienthistory.model.PatientCondition;
import com.healthcare.epcr.patienthistory.model.PatientDocument;
import com.healthcare.epcr.patienthistory.model.PatientEncounter;
import com.healthcare.epcr.patienthistory.model.PatientLabResult;
import com.healthcare.epcr.patienthistory.model.PatientMedication;
import com.healthcare.epcr.patienthistory.model.PatientVital;
import com.healthcare.epcr.patienthistory.model.PatientClinicalOrder;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PatientHistorySummaryDTO {
    private String patientId;
    private String patientPhotoUrl;
    private List<PatientCondition> conditions;
    private List<PatientMedication> medications;
    private List<PatientEncounter> encounters;
    private List<PatientAdmission> admissions;
    private List<PatientLabResult> labResults;
    private List<PatientVital> vitals;
    private List<PatientDocument> documents;
    private List<PatientClinicalOrder> clinicalOrders;
    private List<PatientTimelineEventDTO> timeline;
}
