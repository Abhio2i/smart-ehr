package com.healthcare.epcr.epcr.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import io.swagger.v3.oas.annotations.media.Schema;
import com.healthcare.epcr.epcr.enums.PatientGender;
import com.healthcare.epcr.epcr.model.AuditEntry;
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
public class PatientCareRecordDTO {
    private String id;
    private String patientId;
    private String patientName;
    private String patientDateOfBirth;
    private PatientGender patientGender;
    private String patientPhone;
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
    private LocalDateTime incidentDateTime;
    private String incidentLocation;
    private String incidentDescription;
    private String incidentType;
    private String incidentNumber;
    private SceneAssessment sceneAssessment;
    private List<CrewMember> crew;
    private IncidentTimeline timeline;
    private String paramedicsId;
    private String paramedicsName;
    private String organizationId;
    private String organizationName;
    @Schema(description = "Legacy complaints field (backward compatibility).")
    private List<String> complaints;
    @Schema(description = "Legacy vitals field (backward compatibility).")
    private List<String> vitals;
    @Schema(description = "Structured complaint assessment (new model).")
    private List<ChiefComplaint> structuredComplaints;
    @Schema(description = "Structured vital signs snapshots (new model).")
    private List<VitalSigns> structuredVitals;
    private String diagnosis;
    private String treatmentProvided;
    private String treatmentPlan;
    @Schema(description = "Diet advice as bullet points.")
    private List<String> dietAdvice;
    @Schema(description = "Clinical notes as bullet points.")
    private List<String> notes;
    private String transportDestination;
    private String transportMode;
    private String careLevel;
    private String icd10Code;
    private String primaryImpression;
    private String secondaryImpression;
    @Schema(description = "Legacy medications list (backward compatibility).")
    private List<String> medicationsAdministered;
    @Schema(description = "Legacy procedures list (backward compatibility).")
    private List<String> proceduresPerformed;
    @Schema(description = "Structured medication administration entries (new model).")
    private List<MedicationAdministered> structuredMedications;
    @Schema(description = "Structured procedure entries (new model).")
    private List<ProcedurePerformed> structuredProcedures;
    private TransportDetail transport;
    private ConsentRecord consent;
    private Map<String, Object> clinicalData;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime submittedAt;
    private String submittedBy;
    private String submittedByName;
    private Boolean qaApproved;
    private LocalDateTime qaApprovedAt;
    private String qaApprovedBy;
    private String qaApprovedByName;
    private List<String> attachmentIds;
    private List<AuditEntry> auditTrail;
    private String feedback;
    private Map<String, Object> dynamicFormResponses;
    private String clinicalTag;
}
