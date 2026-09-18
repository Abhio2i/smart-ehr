package com.healthcare.epcr.billing.service;

import com.healthcare.epcr.billing.model.ClaimItem;
import com.healthcare.epcr.billing.model.HealthCareClaim;
import com.healthcare.epcr.billing.repository.HealthCareClaimRepository;
import com.healthcare.epcr.epcr.enums.PatientGender;
import com.healthcare.epcr.epcr.enums.RecordStatus;
import com.healthcare.epcr.epcr.model.*;
import com.healthcare.epcr.epcr.repository.PatientCareRecordRepository;
import com.healthcare.epcr.organization.model.Organization;
import com.healthcare.epcr.organization.repository.OrganizationRepository;
import com.healthcare.epcr.registration.model.HealthCareCoverage;
import com.healthcare.epcr.registration.repository.HealthCareCoverageRepository;
import com.healthcare.epcr.billing.model.ProviderPaymentRate;
import com.healthcare.epcr.billing.model.ProviderShiftLog;
import com.healthcare.epcr.billing.repository.ProviderPaymentRateRepository;
import com.healthcare.epcr.billing.repository.ProviderShiftLogRepository;
import com.healthcare.epcr.user.model.User;
import com.healthcare.epcr.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Seeds one fully-filled demo claim so the billing portal shows
 * real-looking production data on first boot.
 *
 * Idempotent — skips seeding if the demo claim already exists.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@Order(200) // Run after BillingServiceCodeSeeder (Order 100)
public class BillingDemoDataSeeder {

    // ── Fixed IDs so the seeder is idempotent ─────────────────────────
    private static final String DEMO_ORG_ID        = "org-nwt-ems-demo-001";
    private static final String DEMO_PATIENT_ID    = "PAT-NWT-DEMO-2026";
    private static final String DEMO_EPCR_ID       = "epcr-demo-billing-2026-001";
    private static final String DEMO_COVERAGE_ID   = "cov-demo-nwt-2026-001";
    private static final String DEMO_CLAIM_NUMBER  = "CLM-DEMO-2026-001";

    private final OrganizationRepository         organizationRepository;
    private final PatientCareRecordRepository     epcrRepository;
    private final HealthCareCoverageRepository    coverageRepository;
    private final HealthCareClaimRepository       claimRepository;
    private final UserRepository                  userRepository;
    private final ProviderPaymentRateRepository   rateRepository;
    private final ProviderShiftLogRepository      shiftLogRepository;

    @EventListener(ApplicationReadyEvent.class)
    public void seed() {
        if (claimRepository.findByClaimNumber(DEMO_CLAIM_NUMBER).isPresent()) {
            log.info("[BillingDemoDataSeeder] Demo claim already exists — skipping.");
            return;
        }

        log.info("[BillingDemoDataSeeder] Seeding full demo billing dataset...");

        seedOrganization();
        seedEpcrRecord();
        seedCoverageRecord();
        seedClaim();
        seedProviderPaymentData();

        log.info("[BillingDemoDataSeeder] ✅ Demo billing data seeded successfully.");
    }

    // ── 1. Organization with EMS License Number ───────────────────────
    private void seedOrganization() {
        if (organizationRepository.findById(DEMO_ORG_ID).isPresent()) return;

        Organization org = new Organization();
        org.setId(DEMO_ORG_ID);
        org.setName("Northwest Territories Emergency Medical Services");
        org.setCode("NWT-EMS");
        org.setDescription("Primary government EMS provider for the Northwest Territories, operated under GNWT Dept. of Health & Social Services.");
        org.setAddress("4920 52nd Street");
        org.setCity("Yellowknife");
        org.setState("NT");
        org.setZipCode("X1A 1A4");
        org.setPhone("+1-867-777-7000");
        org.setEmail("ems-billing@gov.nt.ca");
        org.setContactPerson("Dr. Sarah Mackenzie");
        org.setLicenseNumber("EMS-NWT-2024-003782"); // ← Provider Billing # in claims
        org.setOrngeAuthority(false);
        org.setContractedProvider(true);
        org.setActive(true);
        org.setCreatedAt(LocalDateTime.now());
        org.setUpdatedAt(LocalDateTime.now());

        organizationRepository.save(org);
        log.info("[BillingDemoDataSeeder] Organization seeded: {}", DEMO_ORG_ID);
    }

    // ── 2. Fully-Filled ePCR Patient Care Record ──────────────────────
    private void seedEpcrRecord() {
        if (epcrRepository.findById(DEMO_EPCR_ID).isPresent()) return;

        PatientCareRecord rec = new PatientCareRecord();
        rec.setId(DEMO_EPCR_ID);
        rec.setOrganizationId(DEMO_ORG_ID);
        rec.setPatientId(DEMO_PATIENT_ID);
        rec.setPatientName("James William Tłı̨chǫ");
        rec.setPatientDateOfBirth("1978-04-12");
        rec.setPatientGender(PatientGender.MALE);
        rec.setPatientPhone("+1-867-444-2910");
        rec.setPatientAddress("Lot 47 Ndılǫ Road, Yellowknife, NT X1A 3M8");
        rec.setAge(48);
        rec.setBloodGroup("O+");
        rec.setAllergy("Penicillin");
        rec.setComorbidity("Type 2 Diabetes, Hypertension");

        // ── Vitals at Scene ─────────────────────────────────────────
        rec.setSystolicBp(158);
        rec.setDiastolicBp(94);
        rec.setHeartRate(102);
        rec.setPulseRate(102);
        rec.setRespirationRate(22);
        rec.setSpo2(94.5);
        rec.setTemperature(37.2);
        rec.setBloodSugar(11.4);

        // ── Clinical Diagnosis ──────────────────────────────────────
        rec.setIcd10Code("I21.9");          // ← Acute myocardial infarction, unspecified
        rec.setPrimaryImpression("Acute Chest Pain — Suspected STEMI");
        rec.setSecondaryImpression("Hypertensive Crisis");
        rec.setDiagnosis("STEMI (ST-Elevation Myocardial Infarction) with associated hypertensive crisis. Patient presented with severe crushing substernal chest pain radiating to left arm, diaphoresis, and shortness of breath.");

        // ── Incident Info ───────────────────────────────────────────
        rec.setIncidentDateTime(LocalDateTime.now().minusHours(3));
        rec.setIncidentLocation("52nd Street & 50th Ave, Yellowknife, NT");
        rec.setIncidentType("Medical Emergency");
        rec.setIncidentNumber("YK-2026-07-15-0047");
        rec.setIncidentDescription("Bystander-initiated 911 call for male in his late 40s collapsed in parking lot with chest pain.");

        // ── Transport to Hospital ────────────────────────────────────
        TransportDetail transport = new TransportDetail();
        transport.setTransportMode("ALS Ground Ambulance");
        transport.setTransportReason("Acute cardiac event requiring urgent catheterization lab intervention");
        transport.setDestinationFacilityId("STH-01"); // ← Stanton Territorial Hospital
        transport.setDestinationName("Stanton Territorial Hospital — Cardiac Care Unit");
        transport.setDestinationAddress("550 Byrne Road, Yellowknife, NT X1A 0E8");
        transport.setDestinationType("HOSPITAL");
        transport.setReceivingPhysicianName("Dr. Anika Sharma, MD (Cardiology)");
        transport.setReceivingNurseName("RN Patricia Beaulieu");
        transport.setHospitalNotified(true);
        transport.setHospitalNotifiedAt(LocalDateTime.now().minusHours(2).minusMinutes(45));
        transport.setPatientConditionOnDeparture("Stable, cardiac monitoring — oxygen via NRB mask at 15 L/min");
        transport.setPatientConditionOnArrival("Deteriorating — transferred immediately to cath lab");
        transport.setCareLevel("ALS");
        transport.setContinuedCPRDuringTransport(false);
        transport.setAedUsedDuringTransport(true);
        rec.setTransport(transport);
        rec.setTransportDestination("Stanton Territorial Hospital");
        rec.setTransportMode("ALS Ground Ambulance");
        rec.setCareLevel("ALS");

        // ── Crew ─────────────────────────────────────────────────────
        CrewMember lead = new CrewMember();
        lead.setParamedicsId("user-mtr-001");
        lead.setName("Michael Tran");
        lead.setRole("Primary Paramedic");
        lead.setCertificationLevel("Advanced Care Paramedic (ACP)");
        lead.setPrimaryClinician(true);

        CrewMember assist = new CrewMember();
        assist.setParamedicsId("user-bla-002");
        assist.setName("Brittany Lavoie");
        assist.setRole("Assisting Paramedic");
        assist.setCertificationLevel("Primary Care Paramedic (PCP)");
        assist.setPrimaryClinician(false);

        rec.setCrew(List.of(lead, assist));
        rec.setParamedicsId("user-mtr-001");

        // ── Treatment ───────────────────────────────────────────────
        rec.setTreatmentProvided(
            "12-lead ECG performed — confirmed ST-elevation in leads II, III, aVF. " +
            "IV access established (18G right antecubital). " +
            "Aspirin 324mg PO administered. " +
            "Nitroglycerin 0.4mg SL × 2 doses. " +
            "IV Morphine 4mg administered for pain management. " +
            "Oxygen via NRB mask at 15 L/min. " +
            "Continuous cardiac monitoring and SpO2 monitoring throughout transport."
        );

        // ── Procedures (maps to billing codes) ──────────────────────
        ProcedurePerformed proc1 = new ProcedurePerformed();
        proc1.setProcedureName("ALS Ground Ambulance Transport");
        proc1.setSnomedCode("AMB-01");
        proc1.setPerformedAt(LocalDateTime.now().minusHours(2).minusMinutes(50));
        proc1.setPerformedBy("Michael Tran (ACP)");
        proc1.setSuccessful(true);

        ProcedurePerformed proc2 = new ProcedurePerformed();
        proc2.setProcedureName("IV Medication Administration (Morphine 4mg + Nitroglycerin 0.4mg × 2)");
        proc2.setSnomedCode("SUP-02");
        proc2.setPerformedAt(LocalDateTime.now().minusHours(2).minusMinutes(30));
        proc2.setPerformedBy("Michael Tran (ACP)");
        proc2.setSuccessful(true);
        proc2.setPatientResponse("Pain reduced from 9/10 to 5/10 within 8 minutes");

        ProcedurePerformed proc3 = new ProcedurePerformed();
        proc3.setProcedureName("12-Lead ECG Acquisition & Transmission");
        proc3.setSnomedCode("SUP-04");
        proc3.setPerformedAt(LocalDateTime.now().minusHours(2).minusMinutes(55));
        proc3.setPerformedBy("Brittany Lavoie (PCP)");
        proc3.setSuccessful(true);
        proc3.setNotes("Transmitted to receiving cardiologist via Telemetry. STEMI confirmed.");

        rec.setStructuredProcedures(List.of(proc1, proc2, proc3));

        // ── Status & QA ─────────────────────────────────────────────
        rec.setStatus(RecordStatus.APPROVED);
        rec.setQaApproved(true);
        rec.setQaApprovedAt(LocalDateTime.now().minusHours(1));
        rec.setQaApprovedBy("qa-reviewer-001");
        rec.setSubmittedBy("user-mtr-001");
        rec.setSubmittedAt(LocalDateTime.now().minusHours(2));
        rec.setCreatedAt(LocalDateTime.now().minusHours(3));
        rec.setUpdatedAt(LocalDateTime.now().minusHours(1));

        epcrRepository.save(rec);
        log.info("[BillingDemoDataSeeder] ePCR record seeded: {}", DEMO_EPCR_ID);
    }

    // ── 3. NWT Health Care Coverage Record ───────────────────────────
    private void seedCoverageRecord() {
        if (coverageRepository.findByPatientId(DEMO_PATIENT_ID).isPresent()) return;

        HealthCareCoverage cov = new HealthCareCoverage();
        cov.setId(DEMO_COVERAGE_ID);
        cov.setPatientId(DEMO_PATIENT_ID);
        cov.setOrganizationId(DEMO_ORG_ID);
        cov.setNwtPlanNumber("NWT-78412-48");
        cov.setCoverageType("NWT_HEALTH_CARE_PLAN");
        cov.setVerificationStatus("VERIFIED");
        cov.setEligible(true);
        cov.setPlanCode("NWT_GOVT");
        cov.setPayerId("NWT_GOVT");
        cov.setResidencyStatus("PERMANENT_RESIDENT");
        cov.setEffectiveFrom(LocalDate.of(2024, 1, 1));
        cov.setEffectiveTo(LocalDate.of(2027, 12, 31));
        cov.setCardExpiryDate(LocalDate.of(2027, 12, 31));
        cov.setEligibilityCheckMethod("MANUAL");
        cov.setEligibilityCheckResult("ELIGIBLE");
        cov.setEstimatedCoveragePercentage(100.0);
        cov.setLastVerifiedBy("qa-reviewer-001");
        cov.setVerificationNotes("NWT resident verified. Full DHSS coverage applicable for ALS ambulance transport.");
        cov.setLastVerifiedAt(LocalDateTime.now().minusHours(1));
        cov.setCreatedAt(LocalDateTime.now().minusHours(3));
        cov.setUpdatedAt(LocalDateTime.now().minusHours(1));

        coverageRepository.save(cov);
        log.info("[BillingDemoDataSeeder] Coverage record seeded for patient: {}", DEMO_PATIENT_ID);
    }

    // ── 4. Fully-Filled Billing Claim ────────────────────────────────
    private void seedClaim() {
        // Line items matching real NWT EMS billing codes
        ClaimItem transport = new ClaimItem();
        transport.setServiceCode("AMB-01");
        transport.setDescription("ALS Ground Ambulance Transport — Yellowknife to STH");
        transport.setQuantity(1);
        transport.setUnitPrice(450.00);
        transport.setTotal(450.00);

        ClaimItem iv = new ClaimItem();
        iv.setServiceCode("SUP-02");
        iv.setDescription("IV Medication Administration (Morphine 4mg + Nitroglycerin 0.4mg × 2)");
        iv.setQuantity(2);
        iv.setUnitPrice(60.00);
        iv.setTotal(120.00);

        ClaimItem ecg = new ClaimItem();
        ecg.setServiceCode("SUP-04");
        ecg.setDescription("12-Lead ECG Acquisition & Transmission to Receiving Physician");
        ecg.setQuantity(1);
        ecg.setUnitPrice(85.00);
        ecg.setTotal(85.00);

        double total = transport.getTotal() + iv.getTotal() + ecg.getTotal(); // $655.00

        HealthCareClaim claim = new HealthCareClaim();
        claim.setClaimNumber(DEMO_CLAIM_NUMBER);
        claim.setOrganizationId(DEMO_ORG_ID);
        claim.setPatientId(DEMO_PATIENT_ID);
        claim.setPatientName("James William Tłı̨chǫ");
        claim.setPatientCareRecordId(DEMO_EPCR_ID);
        claim.setPayerId("NWT_GOVT");
        claim.setPayerDetails("NWT-78412-48");               // Health card number
        claim.setProviderBillingNumber("EMS-NWT-2024-003782"); // Org license number
        claim.setFacilityCode("STH-01");                     // Stanton Territorial Hospital
        claim.setIcdCode("I21.9");                           // Acute MI, unspecified
        claim.setItems(List.of(transport, iv, ecg));
        claim.setTotalAmount(total);
        claim.setEstimatedCoverageAmount(total);             // NWT covers 100%
        claim.setStatus("DRAFT");
        claim.setCreatedAt(LocalDateTime.now().minusHours(1));
        claim.setUpdatedAt(LocalDateTime.now().minusHours(1));

        claimRepository.save(claim);
        log.info("[BillingDemoDataSeeder] Claim seeded: {} — Total: ${}", DEMO_CLAIM_NUMBER, total);
    }

    private void seedProviderPaymentData() {
        Optional<User> doctorOpt = userRepository.findByEmail("dr.kumar@metroems.com");
        Optional<User> paramedicOpt = userRepository.findByEmail("john.smith@metroems.com");

        if (doctorOpt.isPresent()) {
            User doc = doctorOpt.get();
            if (rateRepository.findByProviderIdAndActiveTrue(doc.getId()).isEmpty()) {
                ProviderPaymentRate rate = ProviderPaymentRate.builder()
                        .providerId(doc.getId())
                        .providerRole("PHYSICIAN")
                        .paymentType("FEE_FOR_SERVICE")
                        .feePerProcedure(200.0)
                        .procedureRateOverrides(java.util.Map.of("SURGICAL_CASE", 350.0))
                        .effectiveFrom(LocalDate.now().minusMonths(1))
                        .active(true)
                        .organizationId(doc.getOrganizationId() != null ? doc.getOrganizationId() : DEMO_ORG_ID)
                        .createdAt(LocalDateTime.now())
                        .updatedAt(LocalDateTime.now())
                        .build();
                rateRepository.save(rate);
                log.info("[BillingDemoDataSeeder] Seeded billing rate for physician {}", doc.getEmail());

                ProviderShiftLog shift1 = ProviderShiftLog.builder()
                        .providerId(doc.getId())
                        .shiftStart(LocalDateTime.now().minusDays(3).withHour(9).withMinute(0))
                        .shiftEnd(LocalDateTime.now().minusDays(3).withHour(11).withMinute(30))
                        .hoursWorked(2.5)
                        .sourceType("SURGICAL_CASE")
                        .sourceRefId("sc-demo-001")
                        .status("CLOSED")
                        .organizationId(doc.getOrganizationId())
                        .createdAt(LocalDateTime.now())
                        .updatedAt(LocalDateTime.now())
                        .build();
                shiftLogRepository.save(shift1);
            }
        }

        if (paramedicOpt.isPresent()) {
            User param = paramedicOpt.get();
            if (rateRepository.findByProviderIdAndActiveTrue(param.getId()).isEmpty()) {
                ProviderPaymentRate rate = ProviderPaymentRate.builder()
                        .providerId(param.getId())
                        .providerRole("PARAMEDIC")
                        .paymentType("HYBRID")
                        .baseRate(45.0)
                        .feePerProcedure(15.0)
                        .procedureRateOverrides(java.util.Map.of("EPCR_INCIDENT", 25.0))
                        .effectiveFrom(LocalDate.now().minusMonths(1))
                        .active(true)
                        .organizationId(param.getOrganizationId() != null ? param.getOrganizationId() : DEMO_ORG_ID)
                        .createdAt(LocalDateTime.now())
                        .updatedAt(LocalDateTime.now())
                        .build();
                rateRepository.save(rate);
                log.info("[BillingDemoDataSeeder] Seeded billing rate for paramedic {}", param.getEmail());

                ProviderShiftLog shift1 = ProviderShiftLog.builder()
                        .providerId(param.getId())
                        .shiftStart(LocalDateTime.now().minusDays(2).withHour(8).withMinute(0))
                        .shiftEnd(LocalDateTime.now().minusDays(2).withHour(16).withMinute(0))
                        .hoursWorked(8.0)
                        .sourceType("HOMECARE_VISIT")
                        .sourceRefId("hcv-demo-001")
                        .status("CLOSED")
                        .organizationId(param.getOrganizationId())
                        .createdAt(LocalDateTime.now())
                        .updatedAt(LocalDateTime.now())
                        .build();
                ProviderShiftLog shift2 = ProviderShiftLog.builder()
                        .providerId(param.getId())
                        .shiftStart(LocalDateTime.now().minusDays(1).withHour(10).withMinute(0))
                        .shiftEnd(LocalDateTime.now().minusDays(1).withHour(12).withMinute(0))
                        .hoursWorked(2.0)
                        .sourceType("EPCR_INCIDENT")
                        .sourceRefId("epcr-demo-002")
                        .status("CLOSED")
                        .organizationId(param.getOrganizationId())
                        .createdAt(LocalDateTime.now())
                        .updatedAt(LocalDateTime.now())
                        .build();
                shiftLogRepository.save(shift1);
                shiftLogRepository.save(shift2);
            }
        }
    }
}
