package com.healthcare.epcr.demo;

import com.healthcare.epcr.epcr.enums.PatientGender;
import com.healthcare.epcr.epcr.enums.RecordStatus;
import com.healthcare.epcr.epcr.model.ChiefComplaint;
import com.healthcare.epcr.epcr.model.CrewMember;
import com.healthcare.epcr.epcr.model.IncidentTimeline;
import com.healthcare.epcr.epcr.model.MedicalHistory;
import com.healthcare.epcr.epcr.model.MedicationAdministered;
import com.healthcare.epcr.epcr.model.PatientCareRecord;
import com.healthcare.epcr.epcr.model.ProcedurePerformed;
import com.healthcare.epcr.epcr.model.SceneAssessment;
import com.healthcare.epcr.epcr.model.TransportDetail;
import com.healthcare.epcr.epcr.model.VitalSigns;
import com.healthcare.epcr.epcr.repository.PatientCareRecordRepository;
import com.healthcare.epcr.patient.model.Patient;
import com.healthcare.epcr.patient.repository.PatientRepository;
import com.healthcare.epcr.patienthistory.enums.ConditionStatus;
import com.healthcare.epcr.patienthistory.enums.MedicationStatus;
import com.healthcare.epcr.patienthistory.model.PatientAdmission;
import com.healthcare.epcr.patienthistory.model.PatientCondition;
import com.healthcare.epcr.patienthistory.model.PatientDocument;
import com.healthcare.epcr.patienthistory.model.PatientEncounter;
import com.healthcare.epcr.patienthistory.model.PatientLabResult;
import com.healthcare.epcr.patienthistory.model.PatientMedication;
import com.healthcare.epcr.patienthistory.model.PatientVital;
import com.healthcare.epcr.patienthistory.repository.PatientAdmissionRepository;
import com.healthcare.epcr.patienthistory.repository.PatientConditionRepository;
import com.healthcare.epcr.patienthistory.repository.PatientDocumentRepository;
import com.healthcare.epcr.patienthistory.repository.PatientEncounterRepository;
import com.healthcare.epcr.patienthistory.repository.PatientLabResultRepository;
import com.healthcare.epcr.patienthistory.repository.PatientMedicationRepository;
import com.healthcare.epcr.patienthistory.repository.PatientVitalRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Component
@Profile("dev")
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.real-life-demo-data.enabled", havingValue = "true")
@Slf4j
public class RealLifeDemoDataLoader implements ApplicationRunner {
    private static final String PATIENT_ID = "PAT-DEMO-10YR-001";
    private static final String ORG_ID = "org123";
    private static final String PARAMEDIC_ID = "user123";
    private static final String EPCR_ID = "epcr-demo-rtc-2022-001";
    private static final String FILE_BASE = "/files/demo-patient-history/";

    private final PatientRepository patientRepository;
    private final PatientCareRecordRepository epcrRepository;
    private final PatientConditionRepository conditionRepository;
    private final PatientMedicationRepository medicationRepository;
    private final PatientEncounterRepository encounterRepository;
    private final PatientAdmissionRepository admissionRepository;
    private final PatientLabResultRepository labResultRepository;
    private final PatientVitalRepository vitalRepository;
    private final PatientDocumentRepository documentRepository;

    @Override
    public void run(ApplicationArguments args) {
        writeLocalDemoPdfs();
        seedPatient();
        seedConditions();
        seedMedications();
        seedEpcr();
        seedEncountersAdmissionsLabsVitalsDocuments();
        seedAdditionalPatients();
        log.info("Real-life demo patient history seeded for {} plus three additional demo patients", PATIENT_ID);
    }

    private void writeLocalDemoPdfs() {
        Path dir = Path.of("files", "demo-patient-history");
        try {
            Files.createDirectories(dir);
            writePdf(dir.resolve("2016-diabetes-care-plan.pdf"), "2016 Diabetes Care Plan",
                    List.of("Patient: Aarav Mehta (" + PATIENT_ID + ")",
                            "HbA1c 8.2%; fasting glucose 162 mg/dL.",
                            "Assessment: newly diagnosed type 2 diabetes mellitus.",
                            "Plan: metformin 500 mg twice daily, diet review, exercise plan, repeat HbA1c in 3 months."));
            writePdf(dir.resolve("2017-diabetic-retina-screening.pdf"), "2017 Diabetic Retina Screening",
                    List.of("Patient: Aarav Mehta (" + PATIENT_ID + ")",
                            "Visual acuity preserved bilaterally.",
                            "Fundus screening: no diabetic retinopathy detected.",
                            "Plan: annual retinal screening and continue glycemic control."));
            writePdf(dir.resolve("2018-hypertension-renal-panel.pdf"), "2018 Hypertension Renal Panel",
                    List.of("BP readings: 154/96 and 150/94 mmHg in clinic.",
                            "Creatinine 0.96 mg/dL; potassium 4.2 mmol/L.",
                            "Assessment: essential hypertension with acceptable baseline renal function.",
                            "Plan: start ramipril 5 mg daily and home BP log."));
            writePdf(dir.resolve("2019-acute-gastroenteritis-discharge.pdf"), "2019 Acute Gastroenteritis Discharge",
                    List.of("Presentation: vomiting, loose stools, dizziness, reduced oral intake.",
                            "Assessment: acute gastroenteritis with mild dehydration.",
                            "Treatment: oral rehydration, ondansetron, observation.",
                            "Disposition: discharged with hydration advice and return precautions."));
            writePdf(dir.resolve("2020-ed-ecg-and-troponin.pdf"), "2020 ED ECG And Troponin",
                    List.of("Presentation: exertional chest discomfort, resolved with rest.",
                            "ECG: normal sinus rhythm, no ST elevation.",
                            "High-sensitivity Troponin I: 5 ng/L, repeat negative.",
                            "Disposition: discharged with cardiology follow-up and statin therapy."));
            writePdf(dir.resolve("2022-rtc-ankle-chest-xray.pdf"), "2022 RTC Ankle And Chest X-Ray",
                    List.of("Incident: two-wheeler road traffic collision.",
                            "Left ankle X-ray: soft tissue swelling, no acute fracture or dislocation.",
                            "Chest X-ray: no pneumothorax, no rib fracture identified.",
                            "Impression: ankle sprain and chest wall contusion."));
            writePdf(dir.resolve("2022-rtc-epcr-run-sheet.pdf"), "2022 RTC ePCR Run Sheet",
                    List.of("EMS incident: INC-RTC-DEMO-2022-0614.",
                            "Initial vitals: BP 148/92, HR 104, RR 20, SpO2 95% room air, GCS 15.",
                            "Treatment: wound irrigation, ankle splint, paracetamol 1 g PO.",
                            "Transport: Metro General Hospital ED, stable handoff."));
            writePdf(dir.resolve("2023-diabetic-kidney-screening.pdf"), "2023 Diabetic Kidney Screening",
                    List.of("Urine albumin-creatinine ratio: 18 mg/g.",
                            "Serum creatinine: 1.02 mg/dL; eGFR estimated above 80 mL/min/1.73m2.",
                            "Interpretation: no albuminuria, kidney function stable.",
                            "Plan: continue annual renal screening and blood pressure control."));
            writePdf(dir.resolve("2025-pneumonia-chest-xray.pdf"), "2025 Pneumonia Chest X-Ray",
                    List.of("Presentation: fever, productive cough, wheeze.",
                            "Chest X-ray: right lower-zone patchy infiltrate.",
                            "CRP 48 mg/L, oxygen saturation 93% on room air.",
                            "Impression: community-acquired pneumonia with bronchospasm."));
            writePdf(dir.resolve("patient-002-stroke-ct-summary.pdf"), "Stroke Alert CT Summary",
                    List.of("Patient: Meera Iyer (PAT-DEMO-REAL-002)",
                            "Presentation: sudden right arm weakness and slurred speech.",
                            "Non-contrast CT head: no acute hemorrhage.",
                            "Disposition: stroke pathway activated; transported to comprehensive stroke center."));
            writePdf(dir.resolve("patient-003-asthma-discharge.pdf"), "Asthma Exacerbation Discharge",
                    List.of("Patient: Rohan Das (PAT-DEMO-REAL-003)",
                            "Presentation: wheeze, chest tightness, SpO2 91% on room air.",
                            "Treatment: nebulized salbutamol/ipratropium and oral steroid.",
                            "Disposition: improved after treatment; discharge action plan provided."));
            writePdf(dir.resolve("patient-004-fracture-xray.pdf"), "Distal Radius Fracture X-Ray",
                    List.of("Patient: Kavya Menon (PAT-DEMO-REAL-004)",
                            "Mechanism: fall from stairs with wrist deformity.",
                            "X-ray: extra-articular distal radius fracture, mild dorsal angulation.",
                            "Disposition: splinted and referred for orthopedic follow-up."));
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to write local demo PDFs", ex);
        }
    }

    private void writePdf(Path path, String title, List<String> lines) throws IOException {
        if (Files.exists(path)) {
            return;
        }
        String escapedTitle = escapePdfText(title);
        StringBuilder content = new StringBuilder();
        content.append("BT\n");
        content.append("/F1 18 Tf\n");
        content.append("72 740 Td\n");
        content.append("(").append(escapedTitle).append(") Tj\n");
        content.append("/F1 11 Tf\n");
        content.append("0 -32 Td\n");
        for (String line : lines) {
            content.append("(").append(escapePdfText(line)).append(") Tj\n");
            content.append("0 -18 Td\n");
        }
        content.append("ET\n");

        String[] objects = new String[] {
                "<< /Type /Catalog /Pages 2 0 R >>",
                "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
                "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
                "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
                "<< /Length " + content.toString().getBytes(StandardCharsets.US_ASCII).length + " >>\nstream\n" + content + "endstream"
        };

        StringBuilder pdf = new StringBuilder("%PDF-1.4\n");
        List<Integer> offsets = new ArrayList<>();
        for (int i = 0; i < objects.length; i++) {
            offsets.add(pdf.toString().getBytes(StandardCharsets.US_ASCII).length);
            pdf.append(i + 1).append(" 0 obj\n");
            pdf.append(objects[i]).append("\n");
            pdf.append("endobj\n");
        }
        int xrefOffset = pdf.toString().getBytes(StandardCharsets.US_ASCII).length;
        pdf.append("xref\n");
        pdf.append("0 ").append(objects.length + 1).append("\n");
        pdf.append("0000000000 65535 f \n");
        for (Integer offset : offsets) {
            pdf.append(String.format("%010d 00000 n \n", offset));
        }
        pdf.append("trailer\n");
        pdf.append("<< /Size ").append(objects.length + 1).append(" /Root 1 0 R >>\n");
        pdf.append("startxref\n");
        pdf.append(xrefOffset).append("\n");
        pdf.append("%%EOF\n");
        Files.writeString(path, pdf.toString(), StandardCharsets.US_ASCII);
    }

    private String escapePdfText(String value) {
        return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)");
    }

    private void seedPatient() {
        patientRepository.findByPatientId(PATIENT_ID).orElseGet(() -> {
            Patient patient = new Patient();
            patient.setId("patient-demo-10yr-001");
            patient.setPatientId(PATIENT_ID);
            patient.setOrganizationId(ORG_ID);
            patient.setEmail("demo.patient.history@metroems.com");
            patient.setPhone("+919000011099");
            patient.setActive(true);
            patient.setCreatedAt(LocalDateTime.now());
            patient.setUpdatedAt(LocalDateTime.now());
            return patientRepository.save(patient);
        });
    }

    private void seedConditions() {
        saveCondition("cond-demo-diabetes", "Type 2 diabetes mellitus", ConditionStatus.ACTIVE, "Moderate",
                LocalDate.of(2016, 4, 18), null,
                "Diagnosed after fasting glucose 162 mg/dL and HbA1c 8.2%. Managed with metformin and diet.");
        saveCondition("cond-demo-hypertension", "Essential hypertension", ConditionStatus.ACTIVE, "Moderate",
                LocalDate.of(2018, 8, 9), null,
                "Repeated clinic readings above 150/90 mmHg. Started ACE inhibitor therapy.");
        saveCondition("cond-demo-chest-pain", "Non-ST elevation chest pain evaluation", ConditionStatus.RESOLVED, "High",
                LocalDate.of(2020, 11, 22), LocalDate.of(2020, 11, 24),
                "Emergency evaluation for exertional chest pain. Troponin negative, ECG without STEMI.");
        saveCondition("cond-demo-rtc-trauma", "Road traffic collision blunt trauma", ConditionStatus.RESOLVED, "High",
                LocalDate.of(2022, 6, 14), LocalDate.of(2022, 7, 8),
                "Two-wheeler RTC with left ankle sprain, chest wall contusion, and abrasions.");
        saveCondition("cond-demo-gastroenteritis", "Acute gastroenteritis with mild dehydration", ConditionStatus.RESOLVED, "Low",
                LocalDate.of(2019, 3, 6), LocalDate.of(2019, 3, 9),
                "Short self-limited illness treated with oral rehydration and antiemetic.");
        saveCondition("cond-demo-pneumonia", "Community-acquired pneumonia with bronchospasm", ConditionStatus.RESOLVED, "Moderate",
                LocalDate.of(2025, 1, 11), LocalDate.of(2025, 1, 26),
                "Right lower-zone infiltrate with wheeze, fever, and productive cough.");
    }

    private void seedMedications() {
        saveMedication("med-demo-metformin", "cond-demo-diabetes", "Metformin", "500 mg", "Twice daily",
                MedicationStatus.ACTIVE, LocalDate.of(2016, 4, 19), null,
                "Taken with meals. No documented hypoglycemia.");
        saveMedication("med-demo-ramipril", "cond-demo-hypertension", "Ramipril", "5 mg", "Once daily",
                MedicationStatus.ACTIVE, LocalDate.of(2018, 8, 10), null,
                "Blood pressure improved to 130s/80s on follow-up.");
        saveMedication("med-demo-atorvastatin", "cond-demo-chest-pain", "Atorvastatin", "20 mg", "Nightly",
                MedicationStatus.ACTIVE, LocalDate.of(2020, 11, 24), null,
                "Started after chest-pain risk assessment.");
        saveMedication("med-demo-amoxiclav", "cond-demo-pneumonia", "Amoxicillin/clavulanate", "625 mg", "Three times daily",
                MedicationStatus.STOPPED, LocalDate.of(2025, 1, 11), LocalDate.of(2025, 1, 18),
                "Completed 7-day course with clinical improvement.");
    }

    private void seedEpcr() {
        if (epcrRepository.existsById(EPCR_ID)) {
            return;
        }
        LocalDateTime incidentAt = LocalDateTime.of(2022, 6, 14, 18, 42);
        PatientCareRecord record = new PatientCareRecord();
        record.setId(EPCR_ID);
        record.setPatientId(PATIENT_ID);
        record.setPatientName("Aarav Mehta");
        record.setPatientDateOfBirth("1978-09-21");
        record.setPatientGender(PatientGender.MALE);
        record.setPatientPhone("+919000011099");
        record.setPatientAddress("12 MG Road, Indiranagar, Bengaluru, Karnataka");
        record.setHeight(172.0);
        record.setWeight(84.0);
        record.setAge(43);
        record.setEmail("demo.patient.history@metroems.com");
        record.setBloodGroup("B+");
        record.setSpo2(95.0);
        record.setRespirationRate(20);
        record.setBloodSugar(146.0);
        record.setHeartRate(104);
        record.setSystolicBp(148);
        record.setDiastolicBp(92);
        record.setPulseRate(104);
        record.setTemperature(37.1);
        record.setComorbidity("Type 2 diabetes mellitus; hypertension");
        record.setAllergy("No known drug allergies");
        record.setDoctor("Dr. Neha Rao");
        record.setCurrentMedicines("Metformin 500 mg BID; Ramipril 5 mg OD; Atorvastatin 20 mg nightly");
        record.setIncidentDateTime(incidentAt);
        record.setIncidentLocation("Outer Ring Road near Domlur flyover, Bengaluru");
        record.setIncidentDescription("Two-wheeler rider struck by turning car at low-to-moderate speed. Helmet worn. No loss of consciousness.");
        record.setIncidentType("Road traffic collision");
        record.setIncidentNumber("INC-RTC-DEMO-2022-0614");
        record.setParamedicsId(PARAMEDIC_ID);
        record.setOrganizationId(ORG_ID);
        record.setComplaints(List.of("Left ankle pain", "Chest wall tenderness", "Right forearm abrasion"));
        record.setVitals(List.of("BP 148/92", "HR 104", "SpO2 95% RA", "GCS 15"));
        record.setStructuredComplaints(List.of(new ChiefComplaint(
                "Left ankle pain after RTC", "Sudden", incidentAt.minusMinutes(12),
                "Movement and weight bearing", "Sharp", "None", 7,
                "Constant since impact", "Chest wall soreness, abrasions", true
        )));
        record.setStructuredVitals(List.of(new VitalSigns(
                incidentAt.plusMinutes(15), 104, 148, 92, 20, 95, "Room air",
                37.1, "Oral", 15, 4, 5, 6, "Alert", 7, "Left ankle",
                146.0, "Normal", "Warm and dry", "Warm", "3 mm", "3 mm", true, true, "Priya Nair"
        )));
        record.setDiagnosis("Blunt trauma after road traffic collision; left ankle sprain; chest wall contusion");
        record.setTreatmentProvided("Primary survey, cervical-spine precautions during assessment, wound cleaning, ankle immobilization, cold pack, analgesia, transport to ED.");
        record.setTreatmentPlan("Continue neurovascular checks, pain control, ankle imaging, and ED trauma evaluation.");
        record.setTransportDestination("Metro General Hospital Emergency Department");
        record.setTransportMode("Ground ambulance");
        record.setCareLevel("BLS with ALS consult");
        record.setIcd10Code("V29.9");
        record.setPrimaryImpression("Road traffic collision with extremity injury");
        record.setSecondaryImpression("Chest wall contusion; diabetes and hypertension history");
        record.setMedicationsAdministered(List.of("Paracetamol 1 g PO"));
        record.setProceduresPerformed(List.of("Ankle splint", "Wound irrigation", "12-lead ECG screening"));
        record.setStructuredMedications(List.of(new MedicationAdministered(
                "Paracetamol", "Calpol", 1000.0, "mg", "PO",
                incidentAt.plusMinutes(28), "Priya Nair", 1, "Pain reduced from 7/10 to 5/10",
                null, "161", "Trauma pain", "None reported", "Given after confirming no allergy."
        )));
        record.setStructuredProcedures(List.of(
                new ProcedurePerformed("Left ankle splint", incidentAt.plusMinutes(24), "Rohan Iyer", true, 1,
                        "Left ankle", "None", "Tolerated", "79321009", "Neurovascular status intact after splint."),
                new ProcedurePerformed("Wound irrigation and dressing", incidentAt.plusMinutes(30), "Priya Nair", true, 1,
                        "Right forearm", "None", "Tolerated", "225358003", "Sterile dressing applied.")
        ));
        record.setSceneAssessment(new SceneAssessment("Urban road", true, "Moving traffic controlled by police",
                true, "Motor vehicle collision", "Left ankle and chest wall", 1, false,
                "Green", "Clear", "Dusk", true, "Vikram S", "+919800000001",
                false, false, "Patient ambulatory with assistance"));
        record.setTimeline(new IncidentTimeline(incidentAt.minusMinutes(8), incidentAt.minusMinutes(7), incidentAt.minusMinutes(6),
                incidentAt.plusMinutes(4), incidentAt.plusMinutes(9), incidentAt.plusMinutes(32),
                incidentAt.plusMinutes(51), incidentAt.plusMinutes(58), incidentAt.plusMinutes(72),
                12L, 28L, 19L, 80L));
        record.setCrew(List.of(
                new CrewMember(PARAMEDIC_ID, "Priya Nair", "Lead paramedic", "EMT-P", "KA-EMS-20418", "2027-12-31", true),
                new CrewMember("user124", "Rohan Iyer", "EMT", "EMT-B", "KA-EMS-31872", "2027-08-31", false)
        ));
        record.setTransport(new TransportDetail("Ground ambulance", "Trauma evaluation and imaging", null,
                "hosp-metro-general", "Metro General Hospital", "45 Residency Road, Bengaluru",
                "Emergency department", "Dr. Manish Sethi", "Nurse Kavya Menon",
                "Stable trauma patient, GCS 15, ankle splinted, vitals stable during transport.", true,
                incidentAt.plusMinutes(35), "Stable with ankle pain", "Stable, handed over to ED triage",
                "BLS with ALS consult", false, false));
        record.setMedicalHistory(new MedicalHistory(
                List.of("Type 2 diabetes mellitus", "Essential hypertension", "Prior chest pain evaluation in 2020"),
                List.of("Metformin", "Ramipril", "Atorvastatin"),
                List.of("No known drug allergies"),
                List.of("Appendectomy in 2008"),
                false, false, null, "Dr. Neha Rao", "+918000011122", "Metro Family Clinic",
                false, false, false, null, false, null, "2022-06-14T18:30:00", "Lunch at 13:30"
        ));
        record.setClinicalData(Map.of(
                "traumaCategory", "RTC",
                "helmetWorn", true,
                "lossOfConsciousness", false,
                "neurovascularStatus", "Left foot pulses present, sensation intact"
        ));
        record.setStatus(RecordStatus.SUBMITTED);
        record.setCreatedAt(incidentAt.plusMinutes(74));
        record.setUpdatedAt(incidentAt.plusMinutes(80));
        record.setSubmittedAt(incidentAt.plusMinutes(80));
        record.setSubmittedBy(PARAMEDIC_ID);
        record.setQaApproved(true);
        record.setQaApprovedAt(incidentAt.plusDays(1));
        record.setQaApprovedBy("qa-reviewer-demo");
        record.setAttachmentIds(List.of("doc-demo-rtc-xray", "doc-demo-epcr-pdf"));
        record.setDynamicFormResponses(Map.of(
                "triagePriority", "Urgent",
                "painReassessment", "5/10 after splint and paracetamol"
        ));
        epcrRepository.save(record);
    }

    private void seedEncountersAdmissionsLabsVitalsDocuments() {
        saveEncounter("enc-demo-diabetes-2016", "cond-demo-diabetes", null, LocalDate.of(2016, 4, 18),
                "Fatigue, polyuria, weight gain", "Outpatient diagnosis with lifestyle and metformin plan",
                List.of("cond-demo-diabetes"), "New diagnosis of type 2 diabetes after screening labs.");
        saveLab("lab-demo-hba1c-2016", "cond-demo-diabetes", "HbA1c", "8.2", "%", "4.0-5.6",
                LocalDate.of(2016, 4, 18), "High", "Consistent with diabetes. Repeat monitoring advised.");
        saveDocument("doc-demo-diabetes-plan", "cond-demo-diabetes", "enc-demo-diabetes-2016", null,
                "Clinic Note", "2016-diabetes-care-plan.pdf", FILE_BASE + "2016-diabetes-care-plan.pdf",
                LocalDate.of(2016, 4, 18), "Initial diabetes care plan and education handout.");

        saveEncounter("enc-demo-retina-2017", "cond-demo-diabetes", null, LocalDate.of(2017, 5, 12),
                "Annual diabetic retinal screening", "No diabetic retinopathy detected",
                List.of("cond-demo-diabetes"), "Routine screening completed with annual follow-up advised.");
        saveLab("lab-demo-hba1c-2017", "cond-demo-diabetes", "HbA1c", "7.1", "%", "4.0-5.6",
                LocalDate.of(2017, 5, 12), "High", "Improved from diagnosis after metformin and lifestyle changes.");
        saveDocument("doc-demo-retina-2017", "cond-demo-diabetes", "enc-demo-retina-2017", null,
                "Retina Screening", "2017-diabetic-retina-screening.pdf", FILE_BASE + "2017-diabetic-retina-screening.pdf",
                LocalDate.of(2017, 5, 12), "Annual diabetic eye screening report.");

        saveEncounter("enc-demo-htn-2018", "cond-demo-hypertension", null, LocalDate.of(2018, 8, 9),
                "Headache with high clinic BP", "Started antihypertensive therapy; advised home BP log",
                List.of("cond-demo-diabetes", "cond-demo-hypertension"), "No focal neurologic deficits. ECG normal sinus rhythm.");
        saveLab("lab-demo-renal-2018", "cond-demo-hypertension", "Creatinine", "0.96", "mg/dL", "0.7-1.3",
                LocalDate.of(2018, 8, 9), "Normal", "Baseline renal function before ACE inhibitor.");
        saveDocument("doc-demo-htn-labs", "cond-demo-hypertension", "enc-demo-htn-2018", null,
                "Lab Report", "2018-hypertension-renal-panel.pdf", FILE_BASE + "2018-hypertension-renal-panel.pdf",
                LocalDate.of(2018, 8, 9), "Renal panel and lipid screening report.");

        saveEncounter("enc-demo-gastro-2019", "cond-demo-gastroenteritis", null, LocalDate.of(2019, 3, 6),
                "Vomiting, loose stools, dizziness", "Observed and discharged after oral rehydration tolerated",
                List.of("cond-demo-diabetes", "cond-demo-hypertension", "cond-demo-gastroenteritis"),
                "Mild dehydration. No abdominal guarding. Glucose monitored because of diabetes.");
        saveLab("lab-demo-electrolytes-2019", "cond-demo-gastroenteritis", "Serum sodium", "136", "mmol/L", "135-145",
                LocalDate.of(2019, 3, 6), "Normal", "Electrolytes acceptable during dehydration episode.");
        saveDocument("doc-demo-gastro-2019", "cond-demo-gastroenteritis", "enc-demo-gastro-2019", null,
                "Discharge Summary", "2019-acute-gastroenteritis-discharge.pdf", FILE_BASE + "2019-acute-gastroenteritis-discharge.pdf",
                LocalDate.of(2019, 3, 6), "Urgent-care discharge instructions for gastroenteritis.");

        saveEncounter("enc-demo-chest-pain-2020", "cond-demo-chest-pain", null, LocalDate.of(2020, 11, 22),
                "Exertional chest discomfort", "Observed in ED; serial troponins negative; discharged with cardiology follow-up",
                List.of("cond-demo-diabetes", "cond-demo-hypertension", "cond-demo-chest-pain"),
                "Chest pain resolved with rest. No STEMI on ECG.");
        saveLab("lab-demo-troponin-2020", "cond-demo-chest-pain", "High-sensitivity Troponin I", "5", "ng/L", "0-19",
                LocalDate.of(2020, 11, 22), "Normal", "Negative serial biomarkers.");
        saveDocument("doc-demo-ecg-2020", "cond-demo-chest-pain", "enc-demo-chest-pain-2020", null,
                "ECG PDF", "2020-ed-ecg-and-troponin.pdf", FILE_BASE + "2020-ed-ecg-and-troponin.pdf",
                LocalDate.of(2020, 11, 22), "12-lead ECG summary and serial troponin report.");

        saveEncounter("enc-demo-rtc-2022", "cond-demo-rtc-trauma", EPCR_ID, LocalDate.of(2022, 6, 14),
                "Left ankle pain and chest wall tenderness after RTC", "Transported to ED, imaging negative for fracture",
                List.of("cond-demo-diabetes", "cond-demo-hypertension", "cond-demo-rtc-trauma"),
                "ePCR linked. Neurovascular status remained intact.");
        saveAdmission("adm-demo-rtc-2022", "cond-demo-rtc-trauma", "Metro General Hospital",
                LocalDate.of(2022, 6, 14), LocalDate.of(2022, 6, 15),
                "Observation after road traffic collision", "Discharged with ankle brace and analgesics",
                "CT head not indicated by decision rule. Chest and ankle X-rays showed no acute fracture.");
        saveLab("lab-demo-cbc-2022", "cond-demo-rtc-trauma", "Hemoglobin", "13.8", "g/dL", "13.0-17.0",
                LocalDate.of(2022, 6, 14), "Normal", "No evidence of acute blood loss.");
        saveDocument("doc-demo-rtc-xray", "cond-demo-rtc-trauma", "enc-demo-rtc-2022", "adm-demo-rtc-2022",
                "X-Ray Report", "2022-rtc-ankle-chest-xray.pdf", FILE_BASE + "2022-rtc-ankle-chest-xray.pdf",
                LocalDate.of(2022, 6, 14), "Left ankle and chest X-ray report after RTC.");
        saveDocument("doc-demo-epcr-pdf", "cond-demo-rtc-trauma", "enc-demo-rtc-2022", "adm-demo-rtc-2022",
                "ePCR PDF", "2022-rtc-epcr-run-sheet.pdf", FILE_BASE + "2022-rtc-epcr-run-sheet.pdf",
                LocalDate.of(2022, 6, 14), "Printable EMS run sheet for RTC response.");

        saveEncounter("enc-demo-renal-2023", "cond-demo-diabetes", null, LocalDate.of(2023, 9, 18),
                "Annual diabetes kidney screening", "Renal function stable without albuminuria",
                List.of("cond-demo-diabetes", "cond-demo-hypertension"),
                "Continued ACE inhibitor and diabetes control. Repeat screening in 12 months.");
        saveLab("lab-demo-acr-2023", "cond-demo-diabetes", "Urine albumin-creatinine ratio", "18", "mg/g", "<30",
                LocalDate.of(2023, 9, 18), "Normal", "No microalbuminuria.");
        saveDocument("doc-demo-renal-2023", "cond-demo-diabetes", "enc-demo-renal-2023", null,
                "Kidney Screening", "2023-diabetic-kidney-screening.pdf", FILE_BASE + "2023-diabetic-kidney-screening.pdf",
                LocalDate.of(2023, 9, 18), "Annual diabetic kidney screening report.");

        saveEncounter("enc-demo-pneumonia-2025", "cond-demo-pneumonia", null, LocalDate.of(2025, 1, 11),
                "Fever, productive cough, wheeze", "Outpatient antibiotics and bronchodilator; recovered by follow-up",
                List.of("cond-demo-diabetes", "cond-demo-hypertension", "cond-demo-pneumonia"),
                "Right lower-zone crepitations. Safety-net advice given because of diabetes.");
        saveLab("lab-demo-crp-2025", "cond-demo-pneumonia", "C-reactive protein", "48", "mg/L", "<5",
                LocalDate.of(2025, 1, 11), "High", "Inflammatory marker elevated with pneumonia.");
        saveDocument("doc-demo-pneumonia-xray", "cond-demo-pneumonia", "enc-demo-pneumonia-2025", null,
                "Chest X-Ray", "2025-pneumonia-chest-xray.pdf", FILE_BASE + "2025-pneumonia-chest-xray.pdf",
                LocalDate.of(2025, 1, 11), "Chest X-ray report showing right lower-zone infiltrate.");

        saveVital("vital-demo-2016", null, "enc-demo-diabetes-2016", LocalDateTime.of(2016, 4, 18, 9, 15),
                132, 84, 88, 98.0, 16, 164.0, "Clinic baseline vitals at diabetes diagnosis.");
        saveVital("vital-demo-2018", null, "enc-demo-htn-2018", LocalDateTime.of(2018, 8, 9, 10, 30),
                154, 96, 82, 98.0, 16, 122.0, "Elevated BP prompting treatment.");
        saveVital("vital-demo-2019", null, "enc-demo-gastro-2019", LocalDateTime.of(2019, 3, 6, 16, 45),
                118, 76, 106, 98.0, 18, 132.0, "Mild tachycardia during dehydration episode.");
        saveVital("vital-demo-2020", null, "enc-demo-chest-pain-2020", LocalDateTime.of(2020, 11, 22, 21, 10),
                142, 88, 96, 97.0, 18, 138.0, "ED triage vitals during chest-pain evaluation.");
        saveVital("vital-demo-2022", EPCR_ID, "enc-demo-rtc-2022", LocalDateTime.of(2022, 6, 14, 18, 57),
                148, 92, 104, 95.0, 20, 146.0, "EMS first full vital set after RTC.");
        saveVital("vital-demo-2023", null, "enc-demo-renal-2023", LocalDateTime.of(2023, 9, 18, 9, 50),
                128, 82, 78, 98.0, 16, 118.0, "Stable vitals during annual diabetes review.");
        saveVital("vital-demo-2025", null, "enc-demo-pneumonia-2025", LocalDateTime.of(2025, 1, 11, 11, 20),
                136, 84, 108, 93.0, 22, 156.0, "Mild hypoxia and tachycardia with pneumonia.");
    }

    private void seedAdditionalPatients() {
        seedAdditionalPatient(
                "PAT-DEMO-REAL-002",
                "patient-demo-real-002",
                "Meera Iyer",
                "1966-02-14",
                PatientGender.FEMALE,
                "+919000022001",
                "meera.iyer.demo@metroems.com",
                "Stroke alert with transient ischemic attack",
                "cond-demo-real-002-stroke",
                "enc-demo-real-002-stroke",
                "lab-demo-real-002-glucose",
                "vital-demo-real-002",
                "doc-demo-real-002-ct",
                "epcr-demo-real-002-stroke",
                LocalDateTime.of(2024, 2, 3, 7, 36),
                "Sudden right arm weakness and slurred speech",
                "Symptoms improved during transport; CT negative for hemorrhage; admitted for TIA workup",
                "Random blood glucose",
                "184",
                "mg/dL",
                "70-180",
                "Borderline high",
                "patient-002-stroke-ct-summary.pdf",
                "Stroke CT Summary",
                "Stroke alert assessment and CT summary.",
                168,
                96,
                112,
                97.0,
                18,
                184.0
        );

        seedAdditionalPatient(
                "PAT-DEMO-REAL-003",
                "patient-demo-real-003",
                "Rohan Das",
                "1992-07-30",
                PatientGender.MALE,
                "+919000022002",
                "rohan.das.demo@metroems.com",
                "Acute asthma exacerbation",
                "cond-demo-real-003-asthma",
                "enc-demo-real-003-asthma",
                "lab-demo-real-003-peakflow",
                "vital-demo-real-003",
                "doc-demo-real-003-discharge",
                "epcr-demo-real-003-asthma",
                LocalDateTime.of(2023, 10, 18, 22, 15),
                "Wheezing and chest tightness after dust exposure",
                "Improved after nebulization and steroid; discharged with inhaler action plan",
                "Peak expiratory flow",
                "290",
                "L/min",
                ">450",
                "Low",
                "patient-003-asthma-discharge.pdf",
                "Asthma Discharge PDF",
                "Asthma ED discharge action plan.",
                132,
                82,
                124,
                91.0,
                26,
                104.0
        );

        seedAdditionalPatient(
                "PAT-DEMO-REAL-004",
                "patient-demo-real-004",
                "Kavya Menon",
                "1984-12-05",
                PatientGender.FEMALE,
                "+919000022003",
                "kavya.menon.demo@metroems.com",
                "Fall with distal radius fracture",
                "cond-demo-real-004-fracture",
                "enc-demo-real-004-fracture",
                "lab-demo-real-004-hb",
                "vital-demo-real-004",
                "doc-demo-real-004-xray",
                "epcr-demo-real-004-fall",
                LocalDateTime.of(2021, 12, 9, 19, 5),
                "Fall on outstretched hand with left wrist deformity",
                "Splinted, analgesia given, X-ray confirmed distal radius fracture",
                "Hemoglobin",
                "12.6",
                "g/dL",
                "12.0-15.5",
                "Normal",
                "patient-004-fracture-xray.pdf",
                "Wrist X-Ray PDF",
                "Left wrist fracture X-ray report.",
                126,
                78,
                98,
                99.0,
                18,
                98.0
        );
    }

    private void seedAdditionalPatient(String patientId, String mongoId, String name, String dob, PatientGender gender,
                                       String phone, String email, String conditionName, String conditionId,
                                       String encounterId, String labId, String vitalId, String documentId,
                                       String epcrId, LocalDateTime eventAt, String chiefComplaint, String outcome,
                                       String labName, String labValue, String labUnit, String labRange,
                                       String labInterpretation, String pdfName, String documentType, String documentNotes,
                                       Integer systolic, Integer diastolic, Integer heartRate, Double spo2,
                                       Integer respiratoryRate, Double glucose) {
        patientRepository.findByPatientId(patientId).orElseGet(() -> {
            Patient patient = new Patient();
            patient.setId(mongoId);
            patient.setPatientId(patientId);
            patient.setOrganizationId(ORG_ID);
            patient.setEmail(email);
            patient.setPhone(phone);
            patient.setActive(true);
            patient.setCreatedAt(LocalDateTime.now());
            patient.setUpdatedAt(LocalDateTime.now());
            return patientRepository.save(patient);
        });

        if (!conditionRepository.existsById(conditionId)) {
            conditionRepository.save(new PatientCondition(conditionId, patientId, conditionName, ConditionStatus.RESOLVED,
                    "Moderate", eventAt.toLocalDate(), eventAt.toLocalDate().plusDays(7),
                    outcome, LocalDateTime.now(), LocalDateTime.now()));
        }
        if (!encounterRepository.existsById(encounterId)) {
            encounterRepository.save(new PatientEncounter(encounterId, patientId, conditionId, epcrId,
                    eventAt.toLocalDate(), chiefComplaint, outcome, List.of(conditionId),
                    "Realistic seeded encounter linked to local PDF and ePCR record.",
                    LocalDateTime.now(), LocalDateTime.now()));
        }
        String admissionId = "adm-" + conditionId;
        if (!admissionRepository.existsById(admissionId)) {
            admissionRepository.save(new PatientAdmission(admissionId, patientId, conditionId,
                    "Metro General Hospital", eventAt.toLocalDate(), eventAt.toLocalDate().plusDays(1),
                    chiefComplaint, outcome, "Seeded hospital/ED observation record for complete demo history.",
                    LocalDateTime.now(), LocalDateTime.now()));
        }
        String medicationId = "med-" + conditionId;
        if (!medicationRepository.existsById(medicationId)) {
            String medicationName = conditionName.toLowerCase().contains("asthma")
                    ? "Salbutamol inhaler"
                    : conditionName.toLowerCase().contains("stroke")
                    ? "Aspirin"
                    : "Paracetamol";
            String dosage = conditionName.toLowerCase().contains("asthma")
                    ? "100 mcg"
                    : conditionName.toLowerCase().contains("stroke")
                    ? "150 mg"
                    : "500 mg";
            String frequency = conditionName.toLowerCase().contains("asthma")
                    ? "2 puffs every 4-6 hours as needed"
                    : conditionName.toLowerCase().contains("stroke")
                    ? "Once daily"
                    : "Every 6 hours as needed";
            medicationRepository.save(new PatientMedication(medicationId, patientId, conditionId, medicationName,
                    dosage, frequency, MedicationStatus.STOPPED, eventAt.toLocalDate(),
                    eventAt.toLocalDate().plusDays(7), "Seeded medication course linked to emergency encounter.",
                    LocalDateTime.now(), LocalDateTime.now()));
        }
        if (!labResultRepository.existsById(labId)) {
            labResultRepository.save(new PatientLabResult(labId, patientId, conditionId, labName, labValue, labUnit,
                    labRange, eventAt.toLocalDate(), labInterpretation, "Seeded lab result for demo patient.",
                    LocalDateTime.now(), LocalDateTime.now()));
        }
        if (!documentRepository.existsById(documentId)) {
            documentRepository.save(new PatientDocument(documentId, patientId, conditionId, encounterId, admissionId,
                    documentType, pdfName, "/api/patients/" + patientId + "/history/documents/" + documentId + "/file",
                    FILE_BASE + pdfName, eventAt.toLocalDate(), documentNotes, LocalDateTime.now(), LocalDateTime.now()));
        }
        if (!vitalRepository.existsById(vitalId)) {
            PatientVital vital = new PatientVital();
            vital.setId(vitalId);
            vital.setPatientId(patientId);
            vital.setOrganizationId(ORG_ID);
            vital.setRecordedBy(PARAMEDIC_ID);
            vital.setRecordedByName("Demo clinician");
            vital.setRecordedAt(eventAt.plusMinutes(12));
            vital.setLinkedEpcrId(epcrId);
            vital.setLinkedEncounterId(encounterId);
            vital.setSystolicBP(systolic);
            vital.setDiastolicBP(diastolic);
            vital.setHeartRate(heartRate);
            vital.setPulseRate(heartRate);
            vital.setOxygenSaturation(spo2);
            vital.setRespiratoryRate(respiratoryRate);
            vital.setOxygenDeliveryMethod(spo2 < 94 ? "Nebulizer oxygen support" : "Room air");
            vital.setGlasgowComaScale(15);
            vital.setGcEye(4);
            vital.setGcVerbal(5);
            vital.setGcMotor(6);
            vital.setAvpu("Alert");
            vital.setPainScore(conditionName.contains("fracture") || conditionName.contains("Fall") ? 8 : 3);
            vital.setTemperature(37.0);
            vital.setTemperatureRoute("Oral");
            vital.setBloodGlucose(glucose);
            vital.setPupilsEqual(true);
            vital.setPupilsReactive(true);
            vital.setSkinColor("Normal");
            vital.setSkinCondition("Dry");
            vital.setSkinTemperature("Warm");
            vital.setNotes("Seeded vital set for " + conditionName + ".");
            vital.setCreatedAt(LocalDateTime.now());
            vital.setUpdatedAt(LocalDateTime.now());
            vitalRepository.save(vital);
        }
        seedAdditionalEpcr(epcrId, patientId, name, dob, gender, phone, email, eventAt, chiefComplaint, outcome,
                conditionName, documentId);
    }

    private void seedAdditionalEpcr(String epcrId, String patientId, String name, String dob, PatientGender gender,
                                    String phone, String email, LocalDateTime eventAt, String chiefComplaint,
                                    String outcome, String impression, String documentId) {
        if (epcrRepository.existsById(epcrId)) {
            return;
        }
        PatientCareRecord record = new PatientCareRecord();
        record.setId(epcrId);
        record.setPatientId(patientId);
        record.setPatientName(name);
        record.setPatientDateOfBirth(dob);
        record.setPatientGender(gender);
        record.setPatientPhone(phone);
        record.setPatientAddress("Demo address, Bengaluru, Karnataka");
        record.setAge(eventAt.getYear() - Integer.parseInt(dob.substring(0, 4)));
        record.setEmail(email);
        record.setBloodGroup(gender == PatientGender.FEMALE ? "O+" : "A+");
        record.setHeight(gender == PatientGender.FEMALE ? 162.0 : 176.0);
        record.setWeight(gender == PatientGender.FEMALE ? 64.0 : 78.0);
        record.setSpo2(impression.toLowerCase().contains("asthma") ? 91.0 : 97.0);
        record.setRespirationRate(impression.toLowerCase().contains("asthma") ? 26 : 18);
        record.setBloodSugar(impression.toLowerCase().contains("stroke") ? 184.0 : 112.0);
        record.setHeartRate(impression.toLowerCase().contains("asthma") ? 124 : 98);
        record.setSystolicBp(impression.toLowerCase().contains("stroke") ? 168 : 126);
        record.setDiastolicBp(impression.toLowerCase().contains("stroke") ? 96 : 78);
        record.setPulseRate(record.getHeartRate());
        record.setTemperature(37.0);
        record.setHemoglobin(impression.toLowerCase().contains("fracture") ? 12.6 : 13.2);
        record.setComorbidity(impression.toLowerCase().contains("stroke")
                ? "Hypertension; hyperlipidemia"
                : impression.toLowerCase().contains("asthma")
                ? "Bronchial asthma"
                : "No major chronic illness documented");
        record.setAllergy("No known drug allergies");
        record.setDoctor("Dr. Demo Consultant");
        record.setCurrentMedicines(impression.toLowerCase().contains("asthma")
                ? "Salbutamol inhaler as needed"
                : impression.toLowerCase().contains("stroke")
                ? "Amlodipine 5 mg OD; Atorvastatin 20 mg nightly"
                : "None regular");
        record.setIncidentDateTime(eventAt);
        record.setIncidentLocation("Bengaluru urban response area");
        record.setIncidentDescription(chiefComplaint);
        record.setIncidentType(impression);
        record.setIncidentNumber("INC-" + epcrId.toUpperCase());
        record.setParamedicsId(PARAMEDIC_ID);
        record.setOrganizationId(ORG_ID);
        record.setComplaints(List.of(chiefComplaint));
        record.setVitals(List.of(
                "BP " + record.getSystolicBp() + "/" + record.getDiastolicBp(),
                "HR " + record.getHeartRate(),
                "RR " + record.getRespirationRate(),
                "SpO2 " + record.getSpo2() + "%"
        ));
        record.setStructuredComplaints(List.of(new ChiefComplaint(
                chiefComplaint,
                "Acute",
                eventAt.minusMinutes(20),
                "Activity related",
                impression.toLowerCase().contains("fracture") ? "Sharp pain" : "Distressing symptoms",
                "None",
                impression.toLowerCase().contains("fracture") ? 8 : 5,
                "Persistent until EMS care",
                outcome,
                impression.toLowerCase().contains("fracture")
        )));
        record.setStructuredVitals(List.of(new VitalSigns(
                eventAt.plusMinutes(12),
                record.getHeartRate(),
                record.getSystolicBp(),
                record.getDiastolicBp(),
                record.getRespirationRate(),
                record.getSpo2().intValue(),
                impression.toLowerCase().contains("asthma") ? "Nebulizer oxygen support" : "Room air",
                record.getTemperature(),
                "Oral",
                15,
                4,
                5,
                6,
                "Alert",
                impression.toLowerCase().contains("fracture") ? 8 : 3,
                impression.toLowerCase().contains("fracture") ? "Left wrist" : null,
                record.getBloodSugar(),
                "Normal",
                "Dry",
                "Warm",
                "3 mm",
                "3 mm",
                true,
                true,
                "Demo clinician"
        )));
        record.setDiagnosis(impression);
        record.setTreatmentProvided(outcome);
        record.setTreatmentPlan("Continue monitoring, reassess symptoms, and follow receiving facility recommendations.");
        record.setTransportDestination("Metro General Hospital Emergency Department");
        record.setTransportMode("Ground ambulance");
        record.setCareLevel("BLS");
        record.setIcd10Code(impression.toLowerCase().contains("stroke")
                ? "G45.9"
                : impression.toLowerCase().contains("asthma")
                ? "J45.901"
                : "S52.5");
        record.setPrimaryImpression(impression);
        record.setSecondaryImpression(chiefComplaint);
        record.setMedicationsAdministered(impression.toLowerCase().contains("asthma")
                ? List.of("Nebulized salbutamol", "Nebulized ipratropium", "Prednisolone PO")
                : impression.toLowerCase().contains("stroke")
                ? List.of("Aspirin after hemorrhage excluded per receiving protocol")
                : List.of("Paracetamol PO"));
        record.setProceduresPerformed(impression.toLowerCase().contains("fracture")
                ? List.of("Wrist splint", "Neurovascular assessment")
                : List.of("Primary survey", "Focused assessment", "Transport monitoring"));
        record.setStructuredMedications(List.of(new MedicationAdministered(
                impression.toLowerCase().contains("asthma") ? "Salbutamol" : "Paracetamol",
                null,
                impression.toLowerCase().contains("asthma") ? 5.0 : 1000.0,
                impression.toLowerCase().contains("asthma") ? "mg" : "mg",
                impression.toLowerCase().contains("asthma") ? "Nebulized" : "PO",
                eventAt.plusMinutes(22),
                "Demo clinician",
                1,
                "Symptoms improved during observation",
                null,
                null,
                impression,
                "No contraindications documented",
                "Seeded structured medication record."
        )));
        record.setStructuredProcedures(List.of(new ProcedurePerformed(
                impression.toLowerCase().contains("fracture") ? "Limb splinting" : "Focused clinical assessment",
                eventAt.plusMinutes(18),
                "Demo clinician",
                true,
                1,
                impression.toLowerCase().contains("fracture") ? "Left wrist" : "General",
                "None",
                "Tolerated",
                null,
                "Seeded structured procedure record."
        )));
        record.setSceneAssessment(new SceneAssessment(
                "Urban residence/public area",
                true,
                "No ongoing hazard",
                impression.toLowerCase().contains("fracture"),
                impression.toLowerCase().contains("fracture") ? "Fall from stairs" : "Medical emergency",
                impression.toLowerCase().contains("fracture") ? "Left wrist" : null,
                1,
                false,
                "Yellow",
                "Clear",
                "Indoor/urban lighting",
                true,
                "Family member",
                "+919800000002",
                false,
                false,
                "No access difficulty"
        ));
        record.setTimeline(new IncidentTimeline(
                eventAt.minusMinutes(8),
                eventAt.minusMinutes(7),
                eventAt.minusMinutes(5),
                eventAt.plusMinutes(4),
                eventAt.plusMinutes(8),
                eventAt.plusMinutes(30),
                eventAt.plusMinutes(48),
                eventAt.plusMinutes(56),
                eventAt.plusMinutes(68),
                12L,
                26L,
                18L,
                76L
        ));
        record.setCrew(List.of(
                new CrewMember(PARAMEDIC_ID, "Demo Paramedic", "Lead clinician", "EMT-P", "KA-EMS-DEMO-01", "2027-12-31", true),
                new CrewMember("user124", "Demo EMT", "Assistant", "EMT-B", "KA-EMS-DEMO-02", "2027-08-31", false)
        ));
        record.setTransport(new TransportDetail(
                "Ground ambulance",
                "Emergency department evaluation",
                null,
                "hosp-metro-general",
                "Metro General Hospital",
                "45 Residency Road, Bengaluru",
                "Emergency department",
                "Dr. Demo Receiver",
                "Nurse Demo",
                outcome,
                true,
                eventAt.plusMinutes(32),
                "Stable during departure",
                "Stable at handoff",
                "BLS",
                false,
                false
        ));
        record.setMedicalHistory(new MedicalHistory(
                List.of(impression),
                impression.toLowerCase().contains("asthma") ? List.of("Salbutamol inhaler") : List.of(),
                List.of("No known drug allergies"),
                List.of("No relevant surgical history documented"),
                false,
                false,
                null,
                "Dr. Demo Consultant",
                "+918000099999",
                "Metro Family Clinic",
                false,
                false,
                false,
                null,
                false,
                null,
                eventAt.minusHours(1).toString(),
                "Meal 4 hours before incident"
        ));
        record.setClinicalData(Map.of(
                "demoPatient", true,
                "source", "RealLifeDemoDataLoader",
                "linkedDocumentId", documentId
        ));
        record.setStatus(RecordStatus.SUBMITTED);
        record.setCreatedAt(eventAt.plusMinutes(70));
        record.setUpdatedAt(eventAt.plusMinutes(75));
        record.setSubmittedAt(eventAt.plusMinutes(75));
        record.setSubmittedBy(PARAMEDIC_ID);
        record.setQaApproved(true);
        record.setQaApprovedAt(eventAt.plusDays(1));
        record.setQaApprovedBy("qa-reviewer-demo");
        record.setAttachmentIds(List.of(documentId));
        record.setFeedback("Demo case seeded for frontend review and patient-history testing.");
        record.setDynamicFormResponses(Map.of(
                "triagePriority", impression.toLowerCase().contains("stroke") ? "High" : "Urgent",
                "receivingFacility", "Metro General Hospital",
                "demoCompleteRecord", true
        ));
        epcrRepository.save(record);
    }

    private void saveCondition(String id, String name, ConditionStatus status, String severity,
                               LocalDate diagnosed, LocalDate resolved, String notes) {
        if (conditionRepository.existsById(id)) return;
        PatientCondition item = new PatientCondition(id, PATIENT_ID, name, status, severity, diagnosed, resolved,
                notes, LocalDateTime.now(), LocalDateTime.now());
        conditionRepository.save(item);
    }

    private void saveMedication(String id, String conditionId, String name, String dosage, String frequency,
                                MedicationStatus status, LocalDate start, LocalDate end, String notes) {
        if (medicationRepository.existsById(id)) return;
        PatientMedication item = new PatientMedication(id, PATIENT_ID, conditionId, name, dosage, frequency,
                status, start, end, notes, LocalDateTime.now(), LocalDateTime.now());
        medicationRepository.save(item);
    }

    private void saveEncounter(String id, String conditionId, String epcrId, LocalDate date, String complaint,
                               String outcome, List<String> activeConditionIds, String notes) {
        if (encounterRepository.existsById(id)) return;
        PatientEncounter item = new PatientEncounter(id, PATIENT_ID, conditionId, epcrId, date, complaint, outcome,
                activeConditionIds, notes, LocalDateTime.now(), LocalDateTime.now());
        encounterRepository.save(item);
    }

    private void saveAdmission(String id, String conditionId, String hospital, LocalDate admitDate,
                               LocalDate dischargeDate, String reason, String outcome, String notes) {
        if (admissionRepository.existsById(id)) return;
        PatientAdmission item = new PatientAdmission(id, PATIENT_ID, conditionId, hospital, admitDate, dischargeDate,
                reason, outcome, notes, LocalDateTime.now(), LocalDateTime.now());
        admissionRepository.save(item);
    }

    private void saveLab(String id, String conditionId, String testName, String value, String unit,
                         String normalRange, LocalDate date, String interpretation, String notes) {
        if (labResultRepository.existsById(id)) return;
        PatientLabResult item = new PatientLabResult(id, PATIENT_ID, conditionId, testName, value, unit, normalRange,
                date, interpretation, notes, LocalDateTime.now(), LocalDateTime.now());
        labResultRepository.save(item);
    }

    private void saveDocument(String id, String conditionId, String encounterId, String admissionId,
                              String type, String fileName, String localUrl, LocalDate date, String notes) {
        if (documentRepository.existsById(id)) return;
        PatientDocument item = new PatientDocument(id, PATIENT_ID, conditionId, encounterId, admissionId, type,
                fileName, "/api/patients/" + PATIENT_ID + "/history/documents/" + id + "/file", localUrl,
                date, notes, LocalDateTime.now(), LocalDateTime.now());
        documentRepository.save(item);
    }

    private void saveVital(String id, String epcrId, String encounterId, LocalDateTime recordedAt,
                           Integer systolic, Integer diastolic, Integer heartRate, Double spo2,
                           Integer respiratoryRate, Double glucose, String notes) {
        if (vitalRepository.existsById(id)) return;
        PatientVital item = new PatientVital();
        item.setId(id);
        item.setPatientId(PATIENT_ID);
        item.setOrganizationId(ORG_ID);
        item.setRecordedBy(PARAMEDIC_ID);
        item.setRecordedByName("Demo clinician");
        item.setRecordedAt(recordedAt);
        item.setLinkedEpcrId(epcrId);
        item.setLinkedEncounterId(encounterId);
        item.setSystolicBP(systolic);
        item.setDiastolicBP(diastolic);
        item.setHeartRate(heartRate);
        item.setPulseRate(heartRate);
        item.setOxygenSaturation(spo2);
        item.setRespiratoryRate(respiratoryRate);
        item.setOxygenDeliveryMethod(spo2 < 94 ? "Room air, advised reassessment" : "Room air");
        item.setGlasgowComaScale(15);
        item.setGcEye(4);
        item.setGcVerbal(5);
        item.setGcMotor(6);
        item.setAvpu("Alert");
        item.setPainScore(epcrId == null ? 0 : 7);
        item.setTemperature(recordedAt.getYear() == 2025 ? 38.3 : 37.0);
        item.setTemperatureRoute("Oral");
        item.setBloodGlucose(glucose);
        item.setPupilsEqual(true);
        item.setPupilsReactive(true);
        item.setSkinColor("Normal");
        item.setSkinCondition("Dry");
        item.setSkinTemperature(recordedAt.getYear() == 2025 ? "Warm" : "Normal");
        item.setNotes(notes);
        item.setCreatedAt(LocalDateTime.now());
        item.setUpdatedAt(LocalDateTime.now());
        vitalRepository.save(item);
    }
}
