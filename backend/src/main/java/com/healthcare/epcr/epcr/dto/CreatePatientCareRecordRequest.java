package com.healthcare.epcr.epcr.dto;

import jakarta.validation.constraints.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import io.swagger.v3.oas.annotations.media.Schema;
import com.healthcare.epcr.epcr.enums.PatientGender;
import com.healthcare.epcr.epcr.model.ChiefComplaint;
import com.healthcare.epcr.epcr.model.ConsentRecord;
import com.healthcare.epcr.epcr.model.CrewMember;
import com.healthcare.epcr.epcr.model.IncidentTimeline;
import com.healthcare.epcr.epcr.model.MedicalHistory;
import com.healthcare.epcr.epcr.model.MedicationAdministered;
import com.healthcare.epcr.epcr.model.ProcedurePerformed;
import com.healthcare.epcr.epcr.model.SceneAssessment;
import com.healthcare.epcr.epcr.model.TransportDetail;
import com.healthcare.epcr.epcr.model.VitalSigns;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class   CreatePatientCareRecordRequest {
    @Schema(description = "Existing patient id. When supplied, patient demographics can be omitted and only new incident data is required.")
    private String patientId;
    @Size(min = 2, max = 100)
    private String patientName;
    private String patientDateOfBirth;
    private PatientGender patientGender;
    @Pattern(regexp = "^[+]?[0-9]{10,}$|^$")
    private String patientPhone;
    @Size(max = 200)
    private String patientAddress;
    private String patientSSNLast4;
    private String patientPhotoUrl;
    private MedicalHistory medicalHistory;
    private Double height;
    private Double weight;
    private Integer age;
    private String email;
    private String bloodGroup;
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
    @NotNull(message = "Incident date/time is required")
    private LocalDateTime incidentDateTime;
    @Size(min = 2, max = 200)
    private String incidentLocation;
    @Size(max = 1000)
    private String incidentDescription;
    @Size(max = 100)
    private String incidentType;
    @JsonIgnore
    @Schema(hidden = true)
    private String incidentNumber;
    private SceneAssessment sceneAssessment;
    private List<CrewMember> crew;
    private IncidentTimeline timeline;
    private String paramedicsId;
    private String organizationId;
    @Schema(description = "Legacy complaints field (backward compatibility).")
    private List<String> complaints;
    @Schema(description = "Legacy vitals field (backward compatibility). Use structuredVitals for detailed vitals.")
    private List<String> vitals;
    @Schema(description = "Structured complaint assessment (new model). Preferred over legacy complaints.")
    private List<ChiefComplaint> structuredComplaints;
    @Schema(description = "Structured vital signs snapshots (new model). Preferred over legacy vitals.")
    private List<VitalSigns> structuredVitals;
    @Size(max = 500)
    private String diagnosis;
    @Size(max = 1000)
    private String treatmentProvided;
    @Size(max = 2000)
    private String treatmentPlan;
    @Schema(description = "Diet advice as bullet points.")
    private List<String> dietAdvice;
    @Schema(description = "Clinical notes as bullet points.")
    private List<String> notes;
    @Size(max = 200)
    private String transportDestination;
    @Size(max = 100)
    private String transportMode;
    @Size(max = 50)
    private String careLevel;
    private String icd10Code;
    private String primaryImpression;
    private String secondaryImpression;
    @Schema(description = "Legacy medications list (backward compatibility).")
    private List<String> medicationsAdministered;
    @Schema(description = "Legacy procedures list (backward compatibility).")
    private List<String> proceduresPerformed;
    @Schema(description = "Structured medication administration entries (new model). Preferred over legacy medicationsAdministered.")
    private List<MedicationAdministered> structuredMedications;
    @Schema(description = "Structured procedure entries (new model). Preferred over legacy proceduresPerformed.")
    private List<ProcedurePerformed> structuredProcedures;
    private TransportDetail transport;
    private ConsentRecord consent;
    private Map<String, Object> clinicalData;
    private Map<String, Object> dynamicFormResponses;
    private String clinicalTag;

    @AssertTrue(message = "patientId is required for an existing patient, or patientName, patientDateOfBirth, and patientGender are required for a new patient")
    @Schema(hidden = true)
    public boolean isPatientIdentityValid() {
        if (patientId != null && !patientId.isBlank()) {
            return true;
        }
        return patientName != null && !patientName.isBlank()
                && patientDateOfBirth != null && !patientDateOfBirth.isBlank()
                && patientGender != null;
    }
}
