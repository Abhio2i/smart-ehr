package com.healthcare.epcr.epcr.model;

import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.annotation.Id;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import com.healthcare.epcr.epcr.enums.RecordStatus;
import com.healthcare.epcr.epcr.enums.PatientGender;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Document(collection = "patient_care_records")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PatientCareRecord {
    @Id
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
    private String organizationId;
    private List<String> complaints;
    private List<String> vitals;
    private List<ChiefComplaint> structuredComplaints;
    private List<VitalSigns> structuredVitals;
    private String diagnosis;
    private String treatmentProvided;
    private String treatmentPlan;
    private List<String> dietAdvice;
    private List<String> notes;
    private String transportDestination;
    private String transportMode;
    private String careLevel;
    private String icd10Code;
    private String primaryImpression;
    private String secondaryImpression;
    private List<String> medicationsAdministered;
    private List<String> proceduresPerformed;
    private List<MedicationAdministered> structuredMedications;
    private List<ProcedurePerformed> structuredProcedures;
    private TransportDetail transport;
    private ConsentRecord consent;
    private Map<String, Object> clinicalData;
    private RecordStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime submittedAt;
    private String submittedBy;
    private Boolean qaApproved;
    private LocalDateTime qaApprovedAt;
    private String qaApprovedBy;
    private List<String> attachmentIds;
    private List<AuditEntry> auditTrail;
    private String feedback;
    private Map<String, Object> dynamicFormResponses;
    private String clinicalTag;

    /** Linked Medical Travel Request ID — set when this ePCR triggers patient transport. */
    private String travelRequestId;

    private com.healthcare.epcr.retention.model.RetentionMetadata retentionMetadata;
}
