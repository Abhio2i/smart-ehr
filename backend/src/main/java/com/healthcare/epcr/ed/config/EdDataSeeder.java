package com.healthcare.epcr.ed.config;

import com.healthcare.epcr.ed.model.EdPatientRecord;
import com.healthcare.epcr.ed.repository.EdPatientRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class EdDataSeeder implements CommandLineRunner {

    private final EdPatientRecordRepository edRepository;

    @Override
    public void run(String... args) {
        if (edRepository.count() == 0) {
            log.info("[EdDataSeeder] Seeding initial active ED Tracking Board dataset...");

            EdPatientRecord p1 = EdPatientRecord.builder()
                    .id("ED-001")
                    .organizationId("ORG-SPREADING-SMILE")
                    .patientId("PAT-ED-901")
                    .patientName("David Miller")
                    .age(54)
                    .gender("MALE")
                    .chiefComplaint("Severe chest pain radiating to jaw, diaphoresis")
                    .ctasLevel(1)
                    .ctasName("Level 1 • Resuscitation")
                    .edZone("Resuscitation Bay")
                    .bedNumber("RESUS-01")
                    .assignedDoctor("Dr. Sarah Jenkins (ER Tech)")
                    .assignedNurse("RN Mark Vance")
                    .arrivalTime(LocalDateTime.now().minusMinutes(25))
                    .triageTime(LocalDateTime.now().minusMinutes(24))
                    .systolicBp(85)
                    .diastolicBp(50)
                    .pulseRate(124)
                    .respirationRate(28)
                    .temperature(97.8)
                    .spo2(89.0)
                    .status("IN_TREATMENT")
                    .lwbs(false)
                    .createdAt(LocalDateTime.now().minusMinutes(25))
                    .updatedAt(LocalDateTime.now().minusMinutes(5))
                    .build();

            EdPatientRecord p2 = EdPatientRecord.builder()
                    .id("ED-002")
                    .organizationId("ORG-SPREADING-SMILE")
                    .patientId("PAT-ED-902")
                    .patientName("Emily Watson")
                    .age(31)
                    .gender("FEMALE")
                    .chiefComplaint("Acute shortness of breath, severe asthma exacerbation")
                    .ctasLevel(2)
                    .ctasName("Level 2 • Emergent")
                    .edZone("Trauma Bay")
                    .bedNumber("TRAUMA-02")
                    .assignedDoctor("Dr. Michael Chang")
                    .assignedNurse("RN Clara Hughes")
                    .arrivalTime(LocalDateTime.now().minusMinutes(45))
                    .triageTime(LocalDateTime.now().minusMinutes(42))
                    .systolicBp(128)
                    .diastolicBp(82)
                    .pulseRate(110)
                    .respirationRate(26)
                    .temperature(98.6)
                    .spo2(92.0)
                    .status("AWAITING_RESULTS")
                    .lwbs(false)
                    .createdAt(LocalDateTime.now().minusMinutes(45))
                    .updatedAt(LocalDateTime.now().minusMinutes(10))
                    .build();

            EdPatientRecord p3 = EdPatientRecord.builder()
                    .id("ED-003")
                    .organizationId("ORG-SPREADING-SMILE")
                    .patientId("PAT-ED-903")
                    .patientName("Lucas Tremblay")
                    .age(12)
                    .gender("MALE")
                    .chiefComplaint("Right lower quadrant abdominal pain, fever 38.5°C")
                    .ctasLevel(3)
                    .ctasName("Level 3 • Urgent")
                    .edZone("Acute Bay A")
                    .bedNumber("ACUTE-A3")
                    .assignedDoctor("Dr. Elena Rostova")
                    .assignedNurse("RN Jennifer Ross")
                    .arrivalTime(LocalDateTime.now().minusHours(1).minusMinutes(15))
                    .triageTime(LocalDateTime.now().minusHours(1).minusMinutes(10))
                    .systolicBp(108)
                    .diastolicBp(68)
                    .pulseRate(96)
                    .respirationRate(20)
                    .temperature(101.3)
                    .spo2(98.0)
                    .status("IN_TREATMENT")
                    .lwbs(false)
                    .createdAt(LocalDateTime.now().minusHours(1).minusMinutes(15))
                    .updatedAt(LocalDateTime.now().minusMinutes(15))
                    .build();

            EdPatientRecord p4 = EdPatientRecord.builder()
                    .id("ED-004")
                    .organizationId("ORG-SPREADING-SMILE")
                    .patientId("PAT-ED-904")
                    .patientName("Hannah Beaulieu")
                    .age(24)
                    .gender("FEMALE")
                    .chiefComplaint("Right wrist deformity after fall while skating")
                    .ctasLevel(4)
                    .ctasName("Level 4 • Less Urgent")
                    .edZone("Fast Track")
                    .bedNumber("FT-04")
                    .assignedDoctor("Dr. Michael Chang")
                    .assignedNurse("RN Paul Kim")
                    .arrivalTime(LocalDateTime.now().minusHours(2))
                    .triageTime(LocalDateTime.now().minusHours(1).minusMinutes(50))
                    .systolicBp(116)
                    .diastolicBp(74)
                    .pulseRate(78)
                    .respirationRate(16)
                    .temperature(98.4)
                    .spo2(99.0)
                    .status("DISPOSITION_READY")
                    .lwbs(false)
                    .createdAt(LocalDateTime.now().minusHours(2))
                    .updatedAt(LocalDateTime.now().minusMinutes(20))
                    .build();

            EdPatientRecord p5 = EdPatientRecord.builder()
                    .id("ED-005")
                    .organizationId("ORG-SPREADING-SMILE")
                    .patientId("PAT-ED-905")
                    .patientName("Robert Taylor")
                    .age(67)
                    .gender("MALE")
                    .chiefComplaint("Suture removal request & prescription refill")
                    .ctasLevel(5)
                    .ctasName("Level 5 • Non-Urgent")
                    .edZone("Waiting Room")
                    .bedNumber("WAIT-09")
                    .assignedDoctor("Unassigned")
                    .assignedNurse("RN Triage")
                    .arrivalTime(LocalDateTime.now().minusHours(2).minusMinutes(30))
                    .triageTime(LocalDateTime.now().minusHours(2).minusMinutes(20))
                    .systolicBp(130)
                    .diastolicBp(80)
                    .pulseRate(72)
                    .respirationRate(14)
                    .temperature(98.6)
                    .spo2(98.0)
                    .status("TRIAGED")
                    .lwbs(false)
                    .createdAt(LocalDateTime.now().minusHours(2).minusMinutes(30))
                    .updatedAt(LocalDateTime.now().minusHours(2).minusMinutes(20))
                    .build();

            edRepository.saveAll(List.of(p1, p2, p3, p4, p5));
            log.info("[EdDataSeeder] ✅ 5 initial ED bed records (CTAS 1 to 5) successfully seeded into MongoDB!");
        }
    }
}
