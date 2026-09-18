package com.healthcare.epcr.dental.config;

import com.healthcare.epcr.dental.entity.DentalChart;
import com.healthcare.epcr.dental.repository.DentalChartRepository;
import com.healthcare.epcr.epcr.enums.PatientGender;
import com.healthcare.epcr.epcr.enums.RecordStatus;
import com.healthcare.epcr.epcr.model.PatientCareRecord;
import com.healthcare.epcr.epcr.repository.PatientCareRecordRepository;
import com.healthcare.epcr.organization.model.Organization;
import com.healthcare.epcr.organization.repository.OrganizationRepository;
import com.healthcare.epcr.patient.model.Patient;
import com.healthcare.epcr.patient.repository.PatientRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Seed accurate Pediatric Dental Case Record for Master A.B. (7 Y/O Male)
 * for the "Spreading Smile" organization into MongoDB production database.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class PediatricDentalCaseSeeder implements CommandLineRunner {

    private final OrganizationRepository organizationRepository;
    private final PatientRepository patientRepository;
    private final PatientCareRecordRepository patientCareRecordRepository;
    private final DentalChartRepository dentalChartRepository;

    public static final String ORG_CODE = "SPREADING_SMILE";
    public static final String PATIENT_ID = "PAT-AB-007";
    public static final String INCIDENT_NUMBER = "INC-2026-0115-DENT";

    @Override
    public void run(String... args) {
        try {
            log.info("[PediatricDentalCaseSeeder] Checking/Seeding Pediatric Dental Case for Spreading Smile Org...");

            // 1. Ensure "Spreading Smile" Organization exists
            Organization org = organizationRepository.findByCode(ORG_CODE)
                    .orElseGet(() -> {
                        Organization newOrg = new Organization();
                        newOrg.setName("Spreading Smile");
                        newOrg.setCode(ORG_CODE);
                        newOrg.setDescription("Spreading Smile Pediatric Oral & Dental Health Service");
                        newOrg.setAddress("100 Smile Way, Dental Health Wing");
                        newOrg.setCity("Yellowknife");
                        newOrg.setState("NT");
                        newOrg.setZipCode("X1A 2L9");
                        newOrg.setPhone("+1-867-555-7645");
                        newOrg.setEmail("info@spreadingsmile.org");
                        newOrg.setActive(true);
                        newOrg.setCreatedAt(LocalDateTime.now());
                        newOrg.setUpdatedAt(LocalDateTime.now());
                        return organizationRepository.save(newOrg);
                    });
            String orgId = org.getId();
            log.info("[PediatricDentalCaseSeeder] Organization verified: {} (ID: {})", org.getName(), orgId);

            // 2. Ensure Patient "Master A.B." exists
            Patient patient = patientRepository.findByPatientId(PATIENT_ID)
                    .orElseGet(() -> {
                        Patient p = new Patient();
                        p.setPatientId(PATIENT_ID);
                        p.setOrganizationId(orgId);
                        p.setEmail("mother.masterab@example.com");
                        p.setPhone("+1-867-555-0199");
                        p.setActive(true);
                        p.setCreatedAt(LocalDateTime.of(2026, 1, 15, 9, 0));
                        p.setUpdatedAt(LocalDateTime.now());
                        return patientRepository.save(p);
                    });
            log.info("[PediatricDentalCaseSeeder] Patient verified: Master A.B. (ID: {})", patient.getPatientId());

            // 3. Ensure ePCR PatientCareRecord exists
            if (!patientCareRecordRepository.existsByIncidentNumber(INCIDENT_NUMBER)) {
                PatientCareRecord record = new PatientCareRecord();
                record.setPatientId(PATIENT_ID);
                record.setPatientName("Master A.B.");
                record.setAge(7);
                record.setPatientGender(PatientGender.MALE);
                record.setPatientPhone("+1-867-555-0199");
                record.setPatientAddress("Residential Home, Yellowknife, NT");
                record.setPatientDateOfBirth("2019-01-15");
                record.setOrganizationId(orgId);

                // Incident Details
                record.setIncidentNumber(INCIDENT_NUMBER);
                record.setIncidentDateTime(LocalDateTime.of(2026, 1, 15, 9, 0));
                record.setIncidentLocation("Home (Accidental fall from bed ~1 hr prior to visit)");
                record.setIncidentType("Pediatric Dental Trauma (Ellis Class III Fracture Tooth 11)");
                record.setIncidentDescription(
                    "Child accidentally rolled off bed and hit upper front teeth against floor. " +
                    "Immediate mouth bleeding, severe pain while biting, and sensitivity to cold food and water. " +
                    "No loss of consciousness, vomiting, dizziness, convulsions, or nasal bleeding. Bleeding controlled at home with pressure."
                );

                // Complaints
                record.setComplaints(List.of(
                    "Broken upper front tooth (Tooth 11) with severe pain & bleeding",
                    "Pain while biting",
                    "Sensitivity to cold food and water",
                    "Lip swelling and lower lip abrasion following fall from bed"
                ));

                // Medical & Past Dental History
                com.healthcare.epcr.epcr.model.MedicalHistory medHist = new com.healthcare.epcr.epcr.model.MedicalHistory();
                medHist.setPastConditions(List.of("Medically fit. No systemic illness or hospitalization. Immunizations up to date. No long-term meds."));
                medHist.setAllergies(List.of("No known drug allergy (NKDA)"));
                medHist.setCurrentMedications(List.of("Ibuprofen syrup (10 mg/kg) q8h x 3 days PRN pain", "0.12% Chlorhexidine mouth rinse bid x 1 week"));
                medHist.setNotes(List.of("No previous dental trauma, no root canal treatment. Brushes 1x daily under parental supervision."));
                record.setMedicalHistory(medHist);
                record.setComorbidity("Medically fit, no systemic illness");
                record.setAllergy("No known drug allergy (NKDA)");

                // Vital Signs
                record.setTemperature(98.6); // Normal (37°C)
                record.setPulseRate(90);    // 90 bpm
                record.setSystolicBp(100);
                record.setDiastolicBp(60);  // 100/60 mmHg
                record.setRespirationRate(20); // 20 breaths/min

                // Examination & Diagnosis
                record.setPrimaryImpression("Ellis Class III Fracture Tooth 11 (Permanent Maxillary Right Central Incisor)");
                record.setSecondaryImpression("Pulpal Exposure (~2mm diameter), Lip Abrasion & Mild Upper Lip Swelling");
                record.setDiagnosis("Pulpal necrosis with symptomatic apical periodontitis secondary to traumatic injury (Tooth 11)");
                record.setIcd10Code("S02.5 / K04.1"); // Fracture of tooth / Pulpal necrosis

                // Treatment Provided (Timeline)
                record.setTreatmentProvided(
                    "EMERGENCY TREATMENT (Day 1 - 15 Jan 2026):\n" +
                    "- Clinical examination and IOPA radiograph taken.\n" +
                    "- Tooth 11 cleaned with sterile saline; hemostasis achieved.\n" +
                    "- Calcium hydroxide dressing placed over exposed pulp.\n" +
                    "- Temporary Glass Ionomer Cement (GIC) restoration placed.\n\n" +
                    "FIRST FOLLOW-UP (1 Wk - 22 Jan 2026):\n" +
                    "- Pain reduced, no swelling, mild tenderness on percussion, temp GIC restoration intact. Kept under observation.\n\n" +
                    "SECOND FOLLOW-UP (1 Mo - 15 Feb 2026):\n" +
                    "- Occasional pain while chewing, tender on percussion. IOPA shows slight PDL space widening suggestive of pulpal necrosis."
                );

                // Treatment Plan
                record.setTreatmentPlan("Single-visit Root Canal Treatment (RCT) planned for Tooth 11.");

                // Medications Prescribed
                record.setCurrentMedicines("Ibuprofen syrup (10 mg/kg) q8h x 3 days PRN pain; 0.12% Chlorhexidine mouth rinse bid x 1 week under parental supervision.");
                record.setMedicationsAdministered(List.of(
                    "Ibuprofen Syrup 10mg/kg q8h PRN pain",
                    "0.12% Chlorhexidine Mouth Rinse bid x 7 days"
                ));

                // Diet & Post-op Advice
                record.setDietAdvice(List.of(
                    "Soft diet for 1 week",
                    "Avoid biting hard food items with front teeth",
                    "Maintain good oral hygiene under parental supervision",
                    "Report immediately if swelling, severe pain, or fever develops"
                ));

                record.setDoctor("Dr. Pediatric Dental Surgeon");
                record.setParamedicsId("DENTIST-001");
                record.setStatus(RecordStatus.COMPLETED);
                record.setClinicalTag("PEDIATRIC_DENTAL_TRAUMA");
                record.setCreatedAt(LocalDateTime.of(2026, 1, 15, 10, 0));
                record.setUpdatedAt(LocalDateTime.of(2026, 2, 15, 11, 0));
                record.setSubmittedAt(LocalDateTime.of(2026, 1, 15, 10, 30));
                record.setSubmittedBy("Dr. Pediatric Dental Surgeon");

                patientCareRecordRepository.save(record);
                log.info("[PediatricDentalCaseSeeder] ePCR Record created with incident number: {}", INCIDENT_NUMBER);
            } else {
                log.info("[PediatricDentalCaseSeeder] ePCR Record {} already exists — skipping.", INCIDENT_NUMBER);
            }

            // 4. Ensure DentalChart exists for Master A.B.
            DentalChart chart = dentalChartRepository.findByPatientId(PATIENT_ID)
                    .orElseGet(() -> {
                        List<DentalChart.ToothEntry> toothEntries = new ArrayList<>();

                        // Tooth 11 (Permanent Maxillary Right Central Incisor)
                        toothEntries.add(DentalChart.ToothEntry.builder()
                                .toothNumber(11)
                                .condition(DentalChart.ToothCondition.ROOT_CANAL_TREATED)
                                .surfaceNotes("Ellis Class III Fracture with 2mm pulp exposure; Ca(OH)2 dressing & GIC temp restoration placed 15 Jan 2026; Pulpal necrosis -> Single-visit RCT planned.")
                                .recordedAt(LocalDateTime.of(2026, 1, 15, 10, 0))
                                .build());

                        List<DentalChart.TreatmentRecord> treatments = new ArrayList<>();
                        treatments.add(DentalChart.TreatmentRecord.builder()
                                .treatmentId("TR-AB-001")
                                .toothNumber(11)
                                .type(DentalChart.TreatmentType.EXAMINATION)
                                .performedBy("DENTIST-001")
                                .performedByName("Dr. Pediatric Dental Surgeon")
                                .providerRole("DENTIST")
                                .performedAt(LocalDateTime.of(2026, 1, 15, 10, 30))
                                .notes("Clinical & IOPA examination. Saline wash, hemostasis, Ca(OH)2 pulp cap & GIC temp restoration.")
                                .build());

                        treatments.add(DentalChart.TreatmentRecord.builder()
                                .treatmentId("TR-AB-002")
                                .toothNumber(11)
                                .type(DentalChart.TreatmentType.ROOT_CANAL)
                                .performedBy("DENTIST-001")
                                .performedByName("Dr. Pediatric Dental Surgeon")
                                .providerRole("DENTIST")
                                .performedAt(LocalDateTime.of(2026, 2, 15, 11, 0))
                                .notes("Single-visit Root Canal Treatment (RCT) planned following pulpal necrosis and symptomatic apical periodontitis.")
                                .build());

                        DentalChart newChart = DentalChart.builder()
                                .patientId(PATIENT_ID)
                                .organizationId(orgId)
                                .facilityId("SPREADING-SMILE-MAIN")
                                .toothChart(toothEntries)
                                .treatments(treatments)
                                .lastExaminedBy("DENTIST-001")
                                .lastExaminedByName("Dr. Pediatric Dental Surgeon")
                                .lastExamDate(LocalDateTime.of(2026, 2, 15, 11, 0))
                                .createdAt(LocalDateTime.of(2026, 1, 15, 10, 0))
                                .updatedAt(LocalDateTime.of(2026, 2, 15, 11, 0))
                                .build();

                        return dentalChartRepository.save(newChart);
                    });

            // 5. Seed CASE RECORD 1: Aarav Sharma (8Y Male - Cvek Pulpotomy Tooth 11)
            String patientId2 = "PAT-AARAV-008";
            String incidentNum2 = "INC-2026-0610-DENT";

            Patient patient2 = patientRepository.findByPatientId(patientId2)
                    .orElseGet(() -> {
                        Patient p = new Patient();
                        p.setPatientId(patientId2);
                        p.setOrganizationId(orgId);
                        p.setEmail("mother.aarav@example.com");
                        p.setPhone("+1-867-555-0188");
                        p.setActive(true);
                        p.setCreatedAt(LocalDateTime.of(2026, 6, 10, 10, 0));
                        p.setUpdatedAt(LocalDateTime.now());
                        return patientRepository.save(p);
                    });

            if (!patientCareRecordRepository.existsByIncidentNumber(incidentNum2)) {
                PatientCareRecord record2 = new PatientCareRecord();
                record2.setPatientId(patientId2);
                record2.setPatientName("Aarav Sharma");
                record2.setAge(8);
                record2.setPatientGender(PatientGender.MALE);
                record2.setPatientPhone("+1-867-555-0188");
                record2.setPatientAddress("Residential Community, Yellowknife, NT");
                record2.setPatientDateOfBirth("2018-06-10");
                record2.setOrganizationId(orgId);

                record2.setIncidentNumber(incidentNum2);
                record2.setIncidentDateTime(LocalDateTime.of(2026, 6, 10, 8, 0));
                record2.setIncidentLocation("Play Area (Fall from bicycle ~2 hours prior)");
                record2.setIncidentType("Pediatric Dental Trauma (Complicated Crown Fracture Tooth 11)");
                record2.setIncidentDescription("Child fell from a bicycle approximately 2 hours before reporting. Bleeding from upper front tooth, mild upper lip swelling, severe pain while biting, and sensitivity to cold water. No LOC, vomiting, or systemic injury.");

                record2.setComplaints(List.of(
                    "Complicated crown fracture Tooth 11 with 2mm pulp exposure",
                    "Severe pain while biting",
                    "Sensitivity to cold water",
                    "Mild upper lip swelling & labial mucosa laceration"
                ));

                com.healthcare.epcr.epcr.model.MedicalHistory medHist2 = new com.healthcare.epcr.epcr.model.MedicalHistory();
                medHist2.setPastConditions(List.of("No systemic illness. Immunization complete. No routine meds."));
                medHist2.setAllergies(List.of("No known drug allergy (NKDA)"));
                medHist2.setNotes(List.of("No previous dental trauma or endodontic treatment. Oral hygiene fair."));
                record2.setMedicalHistory(medHist2);

                record2.setTemperature(98.6);
                record2.setPulseRate(85);
                record2.setSystolicBp(102);
                record2.setDiastolicBp(62);
                record2.setRespirationRate(19);

                record2.setPrimaryImpression("Ellis Class III Complicated Crown Fracture Tooth 11 with 2mm Vital Pulp Exposure");
                record2.setDiagnosis("Ellis Class III complicated crown fracture with vital pulp exposure irt 11");
                record2.setIcd10Code("S02.5 / K04.0");

                record2.setTreatmentProvided(
                    "CVEK PARTIAL PULPOTOMY & RESTORATION (10 June 2026):\n" +
                    "- LA administered, rubber dam isolation achieved.\n" +
                    "- ~2mm inflamed coronal pulp tissue removed with sterile diamond bur under water coolant.\n" +
                    "- Hemostasis achieved within 3 minutes.\n" +
                    "- Calcium hydroxide dressing placed over vital pulp, followed by Glass Ionomer Cement (GIC) base.\n" +
                    "- Light-cured composite resin restoration placed, finished, polished, and occlusion adjusted.\n\n" +
                    "POST-OP RADIOGRAPHY:\n" +
                    "- Adequate Ca(OH)2 & restoration placement, good marginal adaptation, normal PDL & intact lamina dura.\n\n" +
                    "FOLLOW-UP (1 Wk, 1 Mo, 3 Mo):\n" +
                    "- Asymptomatic, restoration intact, healthy periapical tissue, vital and functional tooth."
                );

                record2.setTreatmentPlan("Clinical and radiographic follow-up at 1 week, 1 month, 3 months, and 6 months.");
                record2.setCurrentMedicines("Ibuprofen syrup SOS for pain; Chlorhexidine mouth rinse bid x 1 week.");
                record2.setDietAdvice(List.of("Avoid biting hard food for 1 week", "Soft diet for 5-7 days", "Maintain proper oral hygiene"));

                record2.setDoctor("Dr. Pediatric & Preventive Dental Surgeon");
                record2.setParamedicsId("DENTIST-002");
                record2.setStatus(RecordStatus.COMPLETED);
                record2.setClinicalTag("PEDIATRIC_DENTAL_PULPOTOMY");
                record2.setCreatedAt(LocalDateTime.of(2026, 6, 10, 10, 0));
                record2.setUpdatedAt(LocalDateTime.of(2026, 9, 10, 11, 0));

                patientCareRecordRepository.save(record2);
            }

            dentalChartRepository.findByPatientId(patientId2)
                    .orElseGet(() -> {
                        List<DentalChart.ToothEntry> toothEntries = new ArrayList<>();
                        toothEntries.add(DentalChart.ToothEntry.builder()
                                .toothNumber(11)
                                .condition(DentalChart.ToothCondition.FILLED)
                                .surfaceNotes("Cvek Partial Pulpotomy + Ca(OH)2 + GIC base + Light-cured Composite Restoration; vital and functional.")
                                .recordedAt(LocalDateTime.of(2026, 6, 10, 10, 0))
                                .build());

                        List<DentalChart.TreatmentRecord> treatments = new ArrayList<>();
                        treatments.add(DentalChart.TreatmentRecord.builder()
                                .treatmentId("TR-AARAV-001")
                                .toothNumber(11)
                                .type(DentalChart.TreatmentType.FILLING)
                                .performedBy("DENTIST-002")
                                .performedByName("Dr. Pediatric & Preventive Dental Surgeon")
                                .providerRole("DENTIST")
                                .performedAt(LocalDateTime.of(2026, 6, 10, 10, 30))
                                .notes("Cvek Partial Pulpotomy, Ca(OH)2 capping, GIC base, Light-cured composite resin restoration.")
                                .build());

                        DentalChart newChart = DentalChart.builder()
                                .patientId(patientId2)
                                .organizationId(orgId)
                                .facilityId("SPREADING-SMILE-MAIN")
                                .toothChart(toothEntries)
                                .treatments(treatments)
                                .lastExaminedBy("DENTIST-002")
                                .lastExaminedByName("Dr. Pediatric & Preventive Dental Surgeon")
                                .lastExamDate(LocalDateTime.of(2026, 9, 10, 11, 0))
                                .createdAt(LocalDateTime.of(2026, 6, 10, 10, 0))
                                .updatedAt(LocalDateTime.of(2026, 9, 10, 11, 0))
                                .build();

                        return dentalChartRepository.save(newChart);
                    });

            log.info("[PediatricDentalCaseSeeder] ✅ Pediatric Dental Case Records (Master A.B. & Aarav Sharma) successfully seeded into MongoDB!");

        } catch (Exception e) {
            log.error("[PediatricDentalCaseSeeder] Error seeding pediatric dental record: {}", e.getMessage(), e);
        }
    }
}
