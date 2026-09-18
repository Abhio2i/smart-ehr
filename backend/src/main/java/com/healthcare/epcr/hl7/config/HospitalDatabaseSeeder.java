package com.healthcare.epcr.hl7.config;

import com.healthcare.epcr.hl7.model.Hospital;
import com.healthcare.epcr.hl7.repository.HospitalRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class HospitalDatabaseSeeder implements CommandLineRunner {

    private final HospitalRepository hospitalRepository;

    @Override
    public void run(String... args) {
        if (hospitalRepository.existsById("HOSP-CITY-001") || hospitalRepository.count() == 0) {
            log.info("Refreshing default hospital HL7 configurations in MongoDB...");
            hospitalRepository.deleteAll(); // clear the old placeholders
            
            Hospital stanton = Hospital.builder()
                    .id("STH-01")
                    .name("Stanton Territorial Hospital (Yellowknife)")
                    .hl7Ip("127.0.0.1")
                    .hl7Port(5001)
                    .active(true)
                    .build();

            Hospital inuvik = Hospital.builder()
                    .id("IRH-02")
                    .name("Inuvik Regional Hospital")
                    .hl7Ip("127.0.0.1")
                    .hl7Port(5002)
                    .active(true)
                    .build();

            Hospital hayRiver = Hospital.builder()
                    .id("HRR-03")
                    .name("Hay River Regional Health Centre")
                    .hl7Ip("127.0.0.1")
                    .hl7Port(5003)
                    .active(true)
                    .build();

            Hospital fortSmith = Hospital.builder()
                    .id("FSH-04")
                    .name("Fort Smith Health Centre")
                    .hl7Ip("127.0.0.1")
                    .hl7Port(5004)
                    .active(true)
                    .build();

            Hospital ykClinic = Hospital.builder()
                    .id("YK-ACC")
                    .name("Yellowknife Primary Primary Care Clinic")
                    .hl7Ip("127.0.0.1")
                    .hl7Port(5005)
                    .active(true)
                    .build();

            hospitalRepository.saveAll(List.of(stanton, inuvik, hayRiver, fortSmith, ykClinic));
            log.info("Default NWT hospitals seeded successfully!");
        }
    }
}
