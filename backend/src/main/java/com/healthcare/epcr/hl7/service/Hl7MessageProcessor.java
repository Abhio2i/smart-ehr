package com.healthcare.epcr.hl7.service;

import ca.uhn.hl7v2.DefaultHapiContext;
import ca.uhn.hl7v2.HapiContext;
import ca.uhn.hl7v2.model.Message;
import ca.uhn.hl7v2.model.v24.group.ORU_R01_ORDER_OBSERVATION;
import ca.uhn.hl7v2.model.v24.group.ORU_R01_PATIENT_RESULT;
import ca.uhn.hl7v2.model.v24.message.ADT_A01;
import ca.uhn.hl7v2.model.v24.message.ORM_O01;
import ca.uhn.hl7v2.model.v24.message.ORU_R01;
import ca.uhn.hl7v2.model.v24.segment.MSH;
import ca.uhn.hl7v2.model.v24.segment.OBR;
import ca.uhn.hl7v2.model.v24.segment.OBX;
import ca.uhn.hl7v2.model.v24.segment.ORC;
import ca.uhn.hl7v2.model.v24.segment.PID;
import ca.uhn.hl7v2.parser.Parser;
import com.healthcare.epcr.patienthistory.model.PatientVital;
import com.healthcare.epcr.patienthistory.model.PatientMedication;
import com.healthcare.epcr.patienthistory.model.PatientLabResult;
import com.healthcare.epcr.patienthistory.repository.PatientVitalRepository;
import com.healthcare.epcr.patienthistory.repository.PatientMedicationRepository;
import com.healthcare.epcr.patienthistory.repository.PatientLabResultRepository;
import com.healthcare.epcr.patienthistory.enums.MedicationStatus;
import java.time.LocalDate;
import com.healthcare.epcr.patienthistory.enums.TimelineEventType;
import com.healthcare.epcr.patienthistory.model.PatientEncounter;
import com.healthcare.epcr.patienthistory.repository.PatientEncounterRepository;
import ca.uhn.hl7v2.app.DefaultApplication;
import com.healthcare.epcr.patient.model.Patient;
import com.healthcare.epcr.patient.repository.PatientRepository;
import com.healthcare.epcr.phi.crypto.PhiCryptoService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.time.LocalDateTime;

@Service
@Slf4j
public class Hl7MessageProcessor {

    private final PatientRepository patientRepository;
    private final PhiCryptoService phiCryptoService;
    private final PatientVitalRepository patientVitalRepository;
    private final PatientMedicationRepository patientMedicationRepository;
    private final PatientLabResultRepository patientLabResultRepository;
    private final HapiContext hapiContext;

    public Hl7MessageProcessor(PatientRepository patientRepository, 
                               PhiCryptoService phiCryptoService,
                               PatientVitalRepository patientVitalRepository,
                               PatientMedicationRepository patientMedicationRepository,
                               PatientLabResultRepository patientLabResultRepository) {
        this.patientRepository = patientRepository;
        this.phiCryptoService = phiCryptoService;
        this.patientVitalRepository = patientVitalRepository;
        this.patientMedicationRepository = patientMedicationRepository;
        this.patientLabResultRepository = patientLabResultRepository;
        this.hapiContext = new DefaultHapiContext();
        this.hapiContext.setValidationContext(new ca.uhn.hl7v2.validation.impl.NoValidation());
    }

    public String processMessage(String rawHl7) {
        Parser parser = hapiContext.getPipeParser();
        try {
            Message message = parser.parse(rawHl7);

            // ── ADT^A01 — Patient demographic sync ───────────────────────────
            if (message instanceof ADT_A01) {
                handleAdtA01((ADT_A01) message);
            }

            // ── ORU^R01 — Inbound Observation Results (Lab/Vitals from hospital)
            else if (message instanceof ORU_R01) {
                handleOruR01((ORU_R01) message);
            }

            // ── ORM^O01 — Inbound Order Entry (Orders from hospital to EMS) ──
            else if (message instanceof ORM_O01) {
                handleOrmO01((ORM_O01) message);
            }

            // ── Unknown message type ─────────────────────────────────────────
            else {
                MSH msh = (MSH) message.get("MSH");
                String msgType = msh != null
                        ? msh.getMessageType().getMsg1_MessageType().getValue()
                          + "^" + msh.getMessageType().getMsg2_TriggerEvent().getValue()
                        : "UNKNOWN";
                log.warn("[HL7 Inbound] Unsupported message type received: {}", msgType);
            }

            // Generate standard ACK response
            Message ack = DefaultApplication.makeACK(message);
            return parser.encode(ack);

        } catch (Exception e) {
            log.error("Failed to parse and process HL7 message", e);
            try {
                return "MSH|^~\\&|MedEPCR|EMS|||20260702000000||ACK||P|2.4\rMSA|AE||Failed to parse: " + e.getMessage();
            } catch (Exception ex) {
                return "MSH|^~\\&|MedEPCR|EMS|||20260702000000||ACK||P|2.4\rMSA|AE||Critical Error";
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  ADT^A01 — Patient demographic upsert
    // ─────────────────────────────────────────────────────────────────────────
    private void handleAdtA01(ADT_A01 adtMsg) {
        try {
            PID pid = adtMsg.getPID();

            String patientId = pid.getPatientID().getCx1_ID().getValue();
            if (patientId == null || patientId.isBlank()) {
                if (pid.getPatientIdentifierList().length > 0) {
                    patientId = pid.getPatientIdentifierList(0).getCx1_ID().getValue();
                }
            }

            String firstName = "";
            String lastName  = "";
            if (pid.getPatientName().length > 0) {
                firstName = pid.getPatientName(0).getGivenName().getValue();
                lastName  = pid.getPatientName(0).getFamilyName().getFn1_Surname().getValue();
            }

            String phone = "";
            if (pid.getPhoneNumberHome().length > 0) {
                phone = pid.getPhoneNumberHome(0).getAnyText().getValue();
            }

            String email = "";
            if (pid.getPhoneNumberBusiness().length > 0) {
                email = pid.getPhoneNumberBusiness(0).getAnyText().getValue();
            }

            log.info("[HL7 Inbound][ADT^A01] Patient sync — Name: {} {}, ID: {}, Phone: {}",
                    firstName, lastName, patientId, phone);

            if (patientId != null && !patientId.isBlank()) {
                final String lookupId = patientId;
                Patient patient = patientRepository.findByPatientId(lookupId).orElseGet(() -> {
                    Patient p = new Patient();
                    p.setPatientId(lookupId);
                    p.setOrganizationId("org-default");
                    p.setCreatedAt(LocalDateTime.now());
                    return p;
                });

                if (email != null && !email.isBlank()) {
                    patient.setEmail(email.trim().toLowerCase());
                }
                if (phone != null && !phone.isBlank()) {
                    patient.setPhone(phone.trim());
                }
                patient.setActive(true);
                patient.setUpdatedAt(LocalDateTime.now());
                patientRepository.save(patient);
                log.info("[HL7 Inbound][ADT^A01] Patient profile synchronized successfully (ID: {})", patientId);
            }
        } catch (Exception e) {
            log.error("[HL7 Inbound][ADT^A01] Error processing patient sync", e);
        }
    }

    // Helper methods for safety parsing
    private Integer parseInteger(String val) {
        if (val == null || val.isBlank()) return null;
        try {
            return (int) Double.parseDouble(val.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private Double parseDouble(String val) {
        if (val == null || val.isBlank()) return null;
        try {
            return Double.parseDouble(val.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  ORU^R01 — Inbound Observation Results (Lab results / vitals from hospital)
    // ─────────────────────────────────────────────────────────────────────────
    private void handleOruR01(ORU_R01 oruMsg) {
        try {
            ORU_R01_PATIENT_RESULT patientResult = oruMsg.getPATIENT_RESULT();

            // Extract patient identifier
            PID pid = patientResult.getPATIENT().getPID();
            String patientId = pid.getPatientID().getCx1_ID().getValue();
            if (patientId == null || patientId.isBlank()) {
                if (pid.getPatientIdentifierList().length > 0) {
                    patientId = pid.getPatientIdentifierList(0).getCx1_ID().getValue();
                }
            }

            if (patientId == null || patientId.isBlank()) {
                log.warn("[HL7 Inbound][ORU^R01] Received ORU message without Patient ID. Skipping sync.");
                return;
            }

            final String lookupPatientId = patientId;
            java.util.Optional<Patient> patientOpt = patientRepository.findByPatientId(lookupPatientId)
                    .or(() -> patientRepository.findById(lookupPatientId));

            if (patientOpt.isEmpty()) {
                log.warn("[HL7 Inbound][ORU^R01] Patient not found in local system (ID: {}). Skipping sync.", patientId);
                return;
            }

            Patient patient = patientOpt.get();
            PatientVital vital = new PatientVital();
            vital.setPatientId(patient.getPatientId());
            vital.setOrganizationId(patient.getOrganizationId());
            vital.setRecordedBy("HL7_INBOUND");
            vital.setRecordedByName(phiCryptoService.encrypt("Hospital HL7 Interface"));
            vital.setRecordedAt(LocalDateTime.now());
            vital.setCreatedAt(LocalDateTime.now());
            vital.setUpdatedAt(LocalDateTime.now());

            boolean hasAnyValue = false;
            int orderObsCount = patientResult.getORDER_OBSERVATIONReps();
            log.info("[HL7 Inbound][ORU^R01] Syncing observation results for Patient ID: {} — {} order groups",
                    patientId, orderObsCount);

            for (int i = 0; i < orderObsCount; i++) {
                ORU_R01_ORDER_OBSERVATION orderObs = patientResult.getORDER_OBSERVATION(i);

                // Extract each OBX observation segment
                int obxCount = orderObs.getOBSERVATIONReps();
                for (int j = 0; j < obxCount; j++) {
                    OBX obx = orderObs.getOBSERVATION(j).getOBX();
                    String loincCode   = obx.getObservationIdentifier().getCe1_Identifier().getValue();
                    String value = "";
                    if (obx.getObservationValue().length > 0) {
                        value = obx.getObservationValue(0).getData() != null
                                ? obx.getObservationValue(0).getData().toString()
                                : "";
                    }

                    if (loincCode != null && !value.isBlank()) {
                        switch (loincCode) {
                            case "8867-4": // Heart Rate
                                vital.setHeartRate(parseInteger(value));
                                hasAnyValue = true;
                                break;
                            case "59408-5": // SpO2
                                vital.setOxygenSaturation(parseDouble(value));
                                hasAnyValue = true;
                                break;
                            case "9279-1": // Respiratory Rate
                                vital.setRespiratoryRate(parseInteger(value));
                                hasAnyValue = true;
                                break;
                            case "8480-6": // Systolic BP
                                vital.setSystolicBP(parseInteger(value));
                                hasAnyValue = true;
                                break;
                            case "8462-4": // Diastolic BP
                                vital.setDiastolicBP(parseInteger(value));
                                hasAnyValue = true;
                                break;
                            case "8310-5": // Temperature
                                vital.setTemperature(parseDouble(value));
                                hasAnyValue = true;
                                break;
                            case "9269-2": // Glasgow Coma Scale
                                vital.setGlasgowComaScale(parseInteger(value));
                                hasAnyValue = true;
                                break;
                            default:
                                // Process as a general Laboratory test result (SCC LIS Integration)
                                handleLabObservation(patient, obx, loincCode, value);
                                break;
                        }
                    }
                }
            }

            if (hasAnyValue) {
                patientVitalRepository.save(vital);
                log.info("[HL7 Inbound][ORU^R01] Successfully saved PatientVital to database for Patient ID: {}", patientId);
            }
        } catch (Exception e) {
            log.error("[HL7 Inbound][ORU^R01] Error processing inbound observation results", e);
        }
    }

    private void handleLabObservation(Patient patient, OBX obx, String loincCode, String value) {
        try {
            String testName = "";
            if (obx.getObservationIdentifier() != null && obx.getObservationIdentifier().getCe2_Text() != null) {
                testName = obx.getObservationIdentifier().getCe2_Text().getValue();
            }
            if (testName == null || testName.isBlank()) {
                testName = loincCode;
            }

            String unit = "";
            if (obx.getUnits() != null && obx.getUnits().getCe1_Identifier() != null) {
                unit = obx.getUnits().getCe1_Identifier().getValue();
            }

            String referenceRange = "";
            if (obx.getReferencesRange() != null) {
                referenceRange = obx.getReferencesRange().getValue();
            }

            String abnormalFlag = "";
            if (obx.getAbnormalFlags() != null) {
                abnormalFlag = obx.getAbnormalFlags().getValue();
            }

            LocalDate obsDate = LocalDate.now();
            if (obx.getDateTimeOfTheObservation() != null && obx.getDateTimeOfTheObservation().getTimeOfAnEvent() != null) {
                String ts = obx.getDateTimeOfTheObservation().getTimeOfAnEvent().getValue();
                if (ts != null && ts.length() >= 8) {
                    try {
                        int year = Integer.parseInt(ts.substring(0, 4));
                        int month = Integer.parseInt(ts.substring(4, 6));
                        int day = Integer.parseInt(ts.substring(6, 8));
                        obsDate = LocalDate.of(year, month, day);
                    } catch (Exception e) {
                        // ignore and use current date
                    }
                }
            }

            PatientLabResult labResult = new PatientLabResult();
            labResult.setPatientId(patient.getPatientId());
            labResult.setConditionId(null);
            labResult.setTestName(testName);
            labResult.setValue(value);
            labResult.setUnit(unit);
            labResult.setNormalRange(referenceRange);
            labResult.setInterpretation(abnormalFlag);
            labResult.setDate(obsDate);
            labResult.setCreatedAt(LocalDateTime.now());
            labResult.setUpdatedAt(LocalDateTime.now());

            patientLabResultRepository.save(labResult);
            log.info("[HL7 Inbound][ORU^R01] Successfully saved PatientLabResult — Test: {}, Value: {} {} for Patient ID: {}",
                    testName, value, unit, patient.getPatientId());

        } catch (Exception e) {
            log.error("[HL7 Inbound][ORU^R01] Error processing lab observation segment", e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  ORM^O01 — Inbound Order Entry (Hospital sending orders to EMS/system)
    // ─────────────────────────────────────────────────────────────────────────
    private void handleOrmO01(ORM_O01 ormMsg) {
        try {
            // Extract patient identifier
            PID pid = ormMsg.getPATIENT().getPID();
            String patientId = pid.getPatientID().getCx1_ID().getValue();
            if (patientId == null || patientId.isBlank()) {
                if (pid.getPatientIdentifierList().length > 0) {
                    patientId = pid.getPatientIdentifierList(0).getCx1_ID().getValue();
                }
            }

            if (patientId == null || patientId.isBlank()) {
                log.warn("[HL7 Inbound][ORM^O01] Received ORM message without Patient ID. Skipping sync.");
                return;
            }

            final String lookupPatientId = patientId;
            java.util.Optional<Patient> patientOpt = patientRepository.findByPatientId(lookupPatientId)
                    .or(() -> patientRepository.findById(lookupPatientId));

            if (patientOpt.isEmpty()) {
                log.warn("[HL7 Inbound][ORM^O01] Patient not found in local system (ID: {}). Skipping order sync.", patientId);
                return;
            }

            Patient patient = patientOpt.get();
            int orderCount = ormMsg.getORDERReps();
            log.info("[HL7 Inbound][ORM^O01] Processing {} order(s) for Patient ID: {}", orderCount, patientId);

            for (int i = 0; i < orderCount; i++) {
                ca.uhn.hl7v2.model.v24.group.ORM_O01_ORDER orderGroup = ormMsg.getORDER(i);
                ORC orc = orderGroup.getORC();
                OBR obr = orderGroup.getORDER_DETAIL().getOBR();

                String orderControl  = orc.getOrderControl().getValue();
                String orderStatus   = orc.getOrderStatus().getValue();
                String placerOrderId = orc.getPlacerOrderNumber().getEi1_EntityIdentifier().getValue();
                String serviceId     = obr.getUniversalServiceIdentifier().getCe1_Identifier().getValue();
                String serviceName   = obr.getUniversalServiceIdentifier().getCe2_Text().getValue();
                String codingSystem  = obr.getUniversalServiceIdentifier().getCe3_NameOfCodingSystem().getValue();

                log.info("[HL7 Inbound][ORM^O01] Syncing Order [{}]: Control={}, Status={}, Service={} ({})",
                        i + 1, orderControl, orderStatus, serviceName, serviceId);

                // Check if this is a medication order (typically encoded with RXNORM, LOINC, or local system identifiers)
                if (serviceName != null && !serviceName.isBlank()) {
                    PatientMedication medication = new PatientMedication();
                    medication.setPatientId(patient.getPatientId());
                    medication.setConditionId(null);
                    medication.setName(phiCryptoService.encrypt(serviceName));
                    medication.setStatus(MedicationStatus.ACTIVE);
                    medication.setCreatedAt(LocalDateTime.now());
                    medication.setUpdatedAt(LocalDateTime.now());

                    String qty = "";
                    String unit = "";
                    if (obr.getQuantityTiming().length > 0) {
                        qty = obr.getQuantityTiming(0).getQuantity().getQuantity().getValue();
                        unit = obr.getQuantityTiming(0).getQuantity().getUnits().getCe1_Identifier().getValue();
                    }

                    if (qty != null && !qty.isBlank()) {
                        String dosageStr = qty + (unit != null && !unit.isBlank() ? " " + unit : "");
                        medication.setDosage(phiCryptoService.encrypt(dosageStr));
                    } else {
                        medication.setDosage(phiCryptoService.encrypt("As directed"));
                    }

                    String notesStr = "Inbound HL7 Order. PlacerID: " + placerOrderId + ", Control: " + orderControl + ", Status: " + orderStatus;
                    medication.setNotes(phiCryptoService.encrypt(notesStr));

                    patientMedicationRepository.save(medication);
                    log.info("[HL7 Inbound][ORM^O01] Successfully saved PatientMedication: {}", serviceName);
                }
            }
        } catch (Exception e) {
            log.error("[HL7 Inbound][ORM^O01] Error processing inbound order entry message", e);
        }
    }

    @PreDestroy
    public void cleanup() {
        log.info("Cleaning up HL7 Message Processor resources...");
        try {
            if (hapiContext != null) {
                hapiContext.close();
            }
        } catch (IOException e) {
            log.error("Failed to close HapiContext", e);
        }
    }
}

