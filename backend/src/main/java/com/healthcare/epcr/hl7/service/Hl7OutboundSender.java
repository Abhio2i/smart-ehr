package com.healthcare.epcr.hl7.service;

import ca.uhn.hl7v2.DefaultHapiContext;
import ca.uhn.hl7v2.HapiContext;
import ca.uhn.hl7v2.model.v24.group.ORM_O01_ORDER;
import ca.uhn.hl7v2.model.v24.group.ORU_R01_ORDER_OBSERVATION;
import ca.uhn.hl7v2.model.v24.group.ORU_R01_PATIENT_RESULT;
import ca.uhn.hl7v2.model.v24.message.ADT_A01;
import ca.uhn.hl7v2.model.v24.message.ORM_O01;
import ca.uhn.hl7v2.model.v24.message.ORU_R01;
import ca.uhn.hl7v2.model.Message;
import ca.uhn.hl7v2.model.v24.message.ACK;
import ca.uhn.hl7v2.parser.Parser;
import java.io.ByteArrayOutputStream;
import ca.uhn.hl7v2.model.v24.segment.EVN;
import ca.uhn.hl7v2.model.v24.segment.MSH;
import ca.uhn.hl7v2.model.v24.segment.OBR;
import ca.uhn.hl7v2.model.v24.segment.OBX;
import ca.uhn.hl7v2.model.v24.segment.ORC;
import ca.uhn.hl7v2.model.v24.segment.PID;
import com.healthcare.epcr.epcr.model.MedicationAdministered;
import com.healthcare.epcr.epcr.model.ProcedurePerformed;

import jakarta.annotation.PreDestroy;
import java.io.IOException;
import com.healthcare.epcr.epcr.dto.PatientCareRecordDTO;
import com.healthcare.epcr.hl7.config.Hl7Config;
import com.healthcare.epcr.phi.crypto.PhiCryptoService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.Socket;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Service
@Slf4j
public class Hl7OutboundSender {
 
    private final Hl7Config hl7Config;
    private final PhiCryptoService phiCryptoService;
    private final com.healthcare.epcr.hl7.repository.HospitalRepository hospitalRepository;
    private final HapiContext hapiContext;
 
    public Hl7OutboundSender(Hl7Config hl7Config, PhiCryptoService phiCryptoService, 
                             com.healthcare.epcr.hl7.repository.HospitalRepository hospitalRepository) {
        this.hl7Config = hl7Config;
        this.phiCryptoService = phiCryptoService;
        this.hospitalRepository = hospitalRepository;
        this.hapiContext = new DefaultHapiContext();
    }

    public String buildAdmitMessageString(PatientCareRecordDTO record) throws Exception {
        // Build HL7 ADT^A01 (Admit Patient) message
        ADT_A01 adt = new ADT_A01();
        
        // Populate MSH segment
        MSH msh = adt.getMSH();
        msh.getFieldSeparator().setValue("|");
        msh.getEncodingCharacters().setValue("^~\\&");
        msh.getSendingApplication().getHd1_NamespaceID().setValue("MedEPCR");
        msh.getSendingFacility().getHd1_NamespaceID().setValue("EMS-Agency");
        msh.getReceivingApplication().getHd1_NamespaceID().setValue("Hospital-EHR");
        msh.getDateTimeOfMessage().getTs1_TimeOfAnEvent().setValue(
                LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
        );
        msh.getMessageType().getMsg1_MessageType().setValue("ADT");
        msh.getMessageType().getMsg2_TriggerEvent().setValue("A01");
        msh.getMessageControlID().setValue("MSG-" + System.currentTimeMillis());
        msh.getProcessingID().getPt1_ProcessingID().setValue("P");
        msh.getVersionID().getVid1_VersionID().setValue("2.4");

        // Populate EVN segment
        EVN evn = adt.getEVN();
        evn.getEventTypeCode().setValue("A01");
        evn.getRecordedDateTime().getTs1_TimeOfAnEvent().setValue(
                LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
        );

        // Populate PID segment
        PID pid = adt.getPID();
        pid.getPatientID().getCx1_ID().setValue(record.getPatientId());
        pid.getPatientIdentifierList(0).getCx1_ID().setValue(record.getPatientId());
        
        String name = record.getPatientName() != null ? record.getPatientName() : "Unknown";
        String[] nameParts = name.trim().split("\\s+", 2);
        if (nameParts.length > 1) {
            pid.getPatientName(0).getGivenName().setValue(nameParts[0]);
            pid.getPatientName(0).getFamilyName().getFn1_Surname().setValue(nameParts[nameParts.length - 1]);
        } else {
            pid.getPatientName(0).getGivenName().setValue(name);
        }
        
        if (record.getPatientDateOfBirth() != null) {
            String dobFormatted = record.getPatientDateOfBirth().replace("-", ""); // YYYYMMDD
            pid.getDateTimeOfBirth().getTs1_TimeOfAnEvent().setValue(dobFormatted);
        }
        if (record.getPatientGender() != null) {
            pid.getAdministrativeSex().setValue(record.getPatientGender().name().substring(0, 1));
        }
        if (record.getPatientPhone() != null) {
            pid.getPhoneNumberHome(0).getAnyText().setValue(record.getPatientPhone());
        }
        if (record.getEmail() != null) {
            pid.getPhoneNumberBusiness(0).getAnyText().setValue(record.getEmail());
        }
        if (record.getPatientAddress() != null) {
            pid.getPatientAddress(0).getStreetAddress().getSad1_StreetOrMailingAddress().setValue(record.getPatientAddress());
        }

        Parser parser = hapiContext.getPipeParser();
        return parser.encode(adt);
    }

    @Async
    public void sendPatientAdmitMessage(PatientCareRecordDTO record) {
        if (!hl7Config.isEnabled()) {
            return;
        }

        try {
            String hl7Payload = buildAdmitMessageString(record);
            
            // Connect to configured hospital receiver
            String host = hl7Config.getMllp().getHost();
            int port = hl7Config.getMllp().getPort();

            // Dynamic routing based on target hospital
            String targetFacilityId = null;
            String targetName = null;

            if (record.getTransport() != null) {
                targetFacilityId = record.getTransport().getDestinationFacilityId();
                targetName = record.getTransport().getDestinationName();
            }
            if (targetName == null) {
                targetName = record.getTransportDestination();
            }

            java.util.Optional<com.healthcare.epcr.hl7.model.Hospital> targetHospital = java.util.Optional.empty();
            if (targetFacilityId != null && !targetFacilityId.isBlank()) {
                targetHospital = hospitalRepository.findById(targetFacilityId);
            }
            if (targetHospital.isEmpty() && targetName != null && !targetName.isBlank()) {
                targetHospital = hospitalRepository.findByNameIgnoreCase(targetName);
                if (targetHospital.isEmpty()) {
                    // Fallback to fuzzy keyword matching (e.g., "City" matches "City General Hospital")
                    java.util.List<com.healthcare.epcr.hl7.model.Hospital> partialMatches = 
                            hospitalRepository.findByNameContainingIgnoreCase(targetName);
                    if (!partialMatches.isEmpty()) {
                        targetHospital = java.util.Optional.of(partialMatches.get(0));
                    }
                }
            }

            if (targetHospital.isPresent()) {
                com.healthcare.epcr.hl7.model.Hospital hosp = targetHospital.get();
                if (hosp.getHl7Ip() != null && !hosp.getHl7Ip().isBlank() && hosp.getHl7Port() != null) {
                    host = hosp.getHl7Ip();
                    port = hosp.getHl7Port();
                    log.info("Dynamically routed HL7 message to hospital: {} ({}:{})", hosp.getName(), host, port);
                }
            } else {
                log.warn("Destination hospital not found in routing database (ID={}, Name={}). Falling back to default: {}:{}",
                        targetFacilityId, targetName, host, port);
            }
            
            log.info("Sending HL7 ADT^A01 message for Patient ID: {} to {}:{}", record.getPatientId(), host, port);
            
            try (Socket socket = new Socket(host, port);
                 OutputStream out = socket.getOutputStream();
                 InputStream in = socket.getInputStream()) {

                socket.setSoTimeout(5000); // 5-second timeout waiting for ACK

                // Write MLLP-framed HL7 message
                out.write(0x0B);
                out.write(hl7Payload.getBytes("UTF-8"));
                out.write(0x1C);
                out.write(0x0D);
                out.flush();

                log.info("HL7 ADT^A01 message sent successfully, awaiting ACK...");
                readAndProcessAck(in, "ADT^A01");
            }
        } catch (Exception e) {
            log.error("Failed to send outbound HL7 message to legacy EHR receiver", e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  ORU^R01 — Observation Results (Vital Signs / Lab Results)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Builds a raw HL7 v2.4 ORU^R01 message string from the patient's structured vitals.
     * Each vital sign becomes one OBX (Observation) segment within a single OBR group.
     */
    public String buildObservationResultMessageString(PatientCareRecordDTO record) throws Exception {
        ORU_R01 oru = new ORU_R01();

        // ── MSH ──────────────────────────────────────────────────────────────
        MSH msh = oru.getMSH();
        msh.getFieldSeparator().setValue("|");
        msh.getEncodingCharacters().setValue("^~\\&");
        msh.getSendingApplication().getHd1_NamespaceID().setValue("MedEPCR");
        msh.getSendingFacility().getHd1_NamespaceID().setValue("EMS-Agency");
        msh.getReceivingApplication().getHd1_NamespaceID().setValue("Hospital-LIS");
        msh.getReceivingFacility().getHd1_NamespaceID().setValue("Hospital-EHR");
        msh.getDateTimeOfMessage().getTs1_TimeOfAnEvent().setValue(
                LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
        );
        msh.getMessageType().getMsg1_MessageType().setValue("ORU");
        msh.getMessageType().getMsg2_TriggerEvent().setValue("R01");
        msh.getMessageControlID().setValue("ORU-" + System.currentTimeMillis());
        msh.getProcessingID().getPt1_ProcessingID().setValue("P");
        msh.getVersionID().getVid1_VersionID().setValue("2.4");

        // ── PID ──────────────────────────────────────────────────────────────
        ORU_R01_PATIENT_RESULT patientResult = oru.getPATIENT_RESULT();
        PID pid = patientResult.getPATIENT().getPID();
        pid.getPatientID().getCx1_ID().setValue(record.getPatientId());
        pid.getPatientIdentifierList(0).getCx1_ID().setValue(record.getPatientId());

        String name = record.getPatientName() != null ? record.getPatientName() : "Unknown";
        String[] nameParts = name.trim().split("\\s+", 2);
        if (nameParts.length > 1) {
            pid.getPatientName(0).getGivenName().setValue(nameParts[0]);
            pid.getPatientName(0).getFamilyName().getFn1_Surname().setValue(nameParts[nameParts.length - 1]);
        } else {
            pid.getPatientName(0).getGivenName().setValue(name);
        }
        if (record.getPatientDateOfBirth() != null) {
            pid.getDateTimeOfBirth().getTs1_TimeOfAnEvent().setValue(
                    record.getPatientDateOfBirth().replace("-", ""));
        }
        if (record.getPatientGender() != null) {
            pid.getAdministrativeSex().setValue(record.getPatientGender().name().substring(0, 1));
        }

        // ── OBR — Order/Battery header ────────────────────────────────────────
        ORU_R01_ORDER_OBSERVATION orderObs = patientResult.getORDER_OBSERVATION();
        OBR obr = orderObs.getOBR();
        obr.getSetIDOBR().setValue("1");
        obr.getUniversalServiceIdentifier().getCe1_Identifier().setValue("59408-5");
        obr.getUniversalServiceIdentifier().getCe2_Text().setValue("Vital Signs Panel");
        obr.getUniversalServiceIdentifier().getCe3_NameOfCodingSystem().setValue("LN");
        obr.getObservationDateTime().getTs1_TimeOfAnEvent().setValue(
                LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
        );
        obr.getResultStatus().setValue("F"); // F = Final

        // ── OBX — One segment per vital sign ─────────────────────────────────
        int obxIdx = 0;
        if (record.getStructuredVitals() != null) {
            for (Object vitalObj : record.getStructuredVitals()) {
                if (vitalObj instanceof java.util.Map) {
                    @SuppressWarnings("unchecked")
                    java.util.Map<String, Object> vital = (java.util.Map<String, Object>) vitalObj;

                    // Heart Rate (LOINC 8867-4)
                    obxIdx = addObxSegment(orderObs, obxIdx, "8867-4", "Heart rate",
                            safeStr(vital.get("heartRate")), "/min");

                    // SpO2 (LOINC 59408-5)
                    obxIdx = addObxSegment(orderObs, obxIdx, "59408-5", "Oxygen saturation",
                            safeStr(vital.get("spo2")), "%");

                    // Respiratory Rate (LOINC 9279-1)
                    obxIdx = addObxSegment(orderObs, obxIdx, "9279-1", "Respiratory rate",
                            safeStr(vital.get("respiratoryRate")), "/min");

                    // Blood Pressure Systolic (LOINC 8480-6)
                    obxIdx = addObxSegment(orderObs, obxIdx, "8480-6", "Systolic blood pressure",
                            safeStr(vital.get("bloodPressureSystolic")), "mm[Hg]");

                    // Blood Pressure Diastolic (LOINC 8462-4)
                    obxIdx = addObxSegment(orderObs, obxIdx, "8462-4", "Diastolic blood pressure",
                            safeStr(vital.get("bloodPressureDiastolic")), "mm[Hg]");

                    // Temperature (LOINC 8310-5)
                    obxIdx = addObxSegment(orderObs, obxIdx, "8310-5", "Body temperature",
                            safeStr(vital.get("temperature")), "Cel");

                    // GCS Total (LOINC 9269-2)
                    obxIdx = addObxSegment(orderObs, obxIdx, "9269-2", "Glasgow coma score total",
                            safeStr(vital.get("gcsTotal")), "{score}");
                }
            }
        }

        // If no structured vitals, add a placeholder NM observation
        if (obxIdx == 0) {
            addObxSegment(orderObs, obxIdx, "59408-5", "Vital Signs", "N/A", "");
        }

        Parser parser = hapiContext.getPipeParser();
        return parser.encode(oru);
    }

    /**
     * Sends HL7 ORU^R01 observation result message to the destination hospital via MLLP.
     */
    @Async
    public void sendObservationResultMessage(PatientCareRecordDTO record) {
        if (!hl7Config.isEnabled()) {
            return;
        }
        try {
            String hl7Payload = buildObservationResultMessageString(record);

            String host = hl7Config.getMllp().getHost();
            int port = hl7Config.getMllp().getPort();

            // Dynamic routing (same as ADT^A01)
            String targetFacilityId = null;
            String targetName = null;
            if (record.getTransport() != null) {
                targetFacilityId = record.getTransport().getDestinationFacilityId();
                targetName = record.getTransport().getDestinationName();
            }
            if (targetName == null) {
                targetName = record.getTransportDestination();
            }
            java.util.Optional<com.healthcare.epcr.hl7.model.Hospital> targetHospital = java.util.Optional.empty();
            if (targetFacilityId != null && !targetFacilityId.isBlank()) {
                targetHospital = hospitalRepository.findById(targetFacilityId);
            }
            if (targetHospital.isEmpty() && targetName != null && !targetName.isBlank()) {
                targetHospital = hospitalRepository.findByNameIgnoreCase(targetName);
                if (targetHospital.isEmpty()) {
                    java.util.List<com.healthcare.epcr.hl7.model.Hospital> partialMatches =
                            hospitalRepository.findByNameContainingIgnoreCase(targetName);
                    if (!partialMatches.isEmpty()) {
                        targetHospital = java.util.Optional.of(partialMatches.get(0));
                    }
                }
            }
            if (targetHospital.isPresent()) {
                com.healthcare.epcr.hl7.model.Hospital hosp = targetHospital.get();
                if (hosp.getHl7Ip() != null && !hosp.getHl7Ip().isBlank() && hosp.getHl7Port() != null) {
                    host = hosp.getHl7Ip();
                    port = hosp.getHl7Port();
                    log.info("Dynamically routed HL7 ORU^R01 to hospital: {} ({}:{})", hosp.getName(), host, port);
                }
            } else {
                log.warn("Destination hospital not found. Falling back to default: {}:{}", host, port);
            }

            log.info("Sending HL7 ORU^R01 message for Patient ID: {} to {}:{}", record.getPatientId(), host, port);

            try (java.net.Socket socket = new java.net.Socket(host, port);
                 java.io.OutputStream out = socket.getOutputStream();
                 java.io.InputStream in = socket.getInputStream()) {

                socket.setSoTimeout(5000); // 5-second timeout waiting for ACK

                out.write(0x0B);
                out.write(hl7Payload.getBytes("UTF-8"));
                out.write(0x1C);
                out.write(0x0D);
                out.flush();

                log.info("HL7 ORU^R01 message sent successfully to {}:{}, awaiting ACK...", host, port);
                readAndProcessAck(in, "ORU^R01");
            }
        } catch (Exception e) {
            log.error("Failed to send HL7 ORU^R01 observation result message", e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Helper: read and validate inbound ACK from hospital MLLP socket
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Reads the MLLP-framed ACK response from the hospital after sending an outbound
     * HL7 message. Parses the MSA segment and logs success (AA/CA) or failure (AE/AR/CE/CR).
     *
     * @param in          InputStream from the open MLLP socket
     * @param messageType Human-readable message type label (e.g. "ADT^A01")
     */
    private void readAndProcessAck(InputStream in, String messageType) {
        try {
            // Read raw bytes from MLLP frame (start=0x0B, end=0x1C)
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            boolean mllpStarted = false;
            int b;
            while ((b = in.read()) != -1) {
                if (b == 0x0B) {
                    mllpStarted = true;
                    continue;
                }
                if (b == 0x1C) {
                    break; // End of MLLP frame reached
                }
                if (mllpStarted) {
                    buffer.write(b);
                }
            }

            String ackStr = buffer.toString("UTF-8");
            if (ackStr == null || ackStr.isBlank()) {
                log.warn("[HL7 ACK][{}] Received empty ACK response — hospital may not support MLLP ACK", messageType);
                return;
            }

            // Parse the ACK response using HAPI
            Parser parser = hapiContext.getPipeParser();
            Message response = parser.parse(ackStr);

            if (response instanceof ACK) {
                ACK ack = (ACK) response;
                String ackCode   = ack.getMSA().getAcknowledgementCode().getValue();
                String msgCtrlId = ack.getMSA().getMessageControlID().getValue();
                String textMsg   = ack.getMSA().getTextMessage().getValue();

                if ("AA".equalsIgnoreCase(ackCode) || "CA".equalsIgnoreCase(ackCode)) {
                    // Application Accept / Commit Accept
                    log.info("[HL7 ACK][{}] Application Accept — Code: {}, MsgCtrlID: {}",
                            messageType, ackCode, msgCtrlId);
                } else if ("AE".equalsIgnoreCase(ackCode) || "CE".equalsIgnoreCase(ackCode)) {
                    // Application Error / Commit Error
                    log.error("[HL7 ACK][{}] Application Error (NACK) — Code: {}, MsgCtrlID: {}, Details: {}",
                            messageType, ackCode, msgCtrlId, textMsg);
                } else if ("AR".equalsIgnoreCase(ackCode) || "CR".equalsIgnoreCase(ackCode)) {
                    // Application Reject / Commit Reject
                    log.error("[HL7 ACK][{}] Application Reject (NACK) — Code: {}, MsgCtrlID: {}, Details: {}",
                            messageType, ackCode, msgCtrlId, textMsg);
                } else {
                    log.warn("[HL7 ACK][{}] Unknown ACK code '{}' received — Raw (first 200 chars): {}",
                            messageType, ackCode, ackStr.substring(0, Math.min(200, ackStr.length())));
                }
            } else {
                log.warn("[HL7 ACK][{}] Response is not a standard ACK message — Raw (first 200 chars): {}",
                        messageType, ackStr.substring(0, Math.min(200, ackStr.length())));
            }

        } catch (java.net.SocketTimeoutException e) {
            log.warn("[HL7 ACK][{}] Timeout (5s) waiting for ACK — hospital did not respond in time", messageType);
        } catch (Exception e) {
            log.error("[HL7 ACK][{}] Failed to read or parse ACK response from hospital", messageType, e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Helper: add a single OBX segment for a numeric observation
    // ─────────────────────────────────────────────────────────────────────────
    private int addObxSegment(ORU_R01_ORDER_OBSERVATION orderObs,
                               int idx, String loincCode, String loincText,
                               String value, String unit) throws Exception {
        if (value == null || value.isBlank() || "null".equalsIgnoreCase(value)) {
            return idx; // skip missing values
        }
        OBX obx = orderObs.getOBSERVATION(idx).getOBX();
        obx.getSetIDOBX().setValue(String.valueOf(idx + 1));
        obx.getValueType().setValue("NM");
        obx.getObservationIdentifier().getCe1_Identifier().setValue(loincCode);
        obx.getObservationIdentifier().getCe2_Text().setValue(loincText);
        obx.getObservationIdentifier().getCe3_NameOfCodingSystem().setValue("LN");
        obx.getObservationValue(0).getData().parse(value);
        if (!unit.isBlank()) {
            obx.getUnits().getCe1_Identifier().setValue(unit);
        }
        obx.getObservationResultStatus().setValue("F");
        return idx + 1;
    }

    private String safeStr(Object val) {
        return val == null ? "" : val.toString();
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  ORM^O01 — Order Entry (Medications + Procedures)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Builds an HL7 v2.4 ORM^O01 (Order Entry) message string from the patient's
     * structured medications (RxNorm coded) and structured procedures (SNOMED-CT coded).
     * Each medication and each procedure becomes a separate ORC+OBR order group.
     */
    public String buildOrderMessageString(PatientCareRecordDTO record) throws Exception {
        ORM_O01 orm = new ORM_O01();

        // ── MSH ──────────────────────────────────────────────────────────────
        MSH msh = orm.getMSH();
        msh.getFieldSeparator().setValue("|");
        msh.getEncodingCharacters().setValue("^~\\&");
        msh.getSendingApplication().getHd1_NamespaceID().setValue("MedEPCR");
        msh.getSendingFacility().getHd1_NamespaceID().setValue("EMS-Agency");
        msh.getReceivingApplication().getHd1_NamespaceID().setValue("Hospital-LIS");
        msh.getReceivingFacility().getHd1_NamespaceID().setValue("Hospital-EHR");
        msh.getDateTimeOfMessage().getTs1_TimeOfAnEvent().setValue(
                LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")));
        msh.getMessageType().getMsg1_MessageType().setValue("ORM");
        msh.getMessageType().getMsg2_TriggerEvent().setValue("O01");
        msh.getMessageControlID().setValue("ORM-" + System.currentTimeMillis());
        msh.getProcessingID().getPt1_ProcessingID().setValue("P");
        msh.getVersionID().getVid1_VersionID().setValue("2.4");

        // ── PID ──────────────────────────────────────────────────────────────
        PID pid = orm.getPATIENT().getPID();
        pid.getPatientID().getCx1_ID().setValue(record.getPatientId());
        pid.getPatientIdentifierList(0).getCx1_ID().setValue(record.getPatientId());
        String name = record.getPatientName() != null ? record.getPatientName() : "Unknown";
        String[] nameParts = name.trim().split("\\s+", 2);
        if (nameParts.length > 1) {
            pid.getPatientName(0).getGivenName().setValue(nameParts[0]);
            pid.getPatientName(0).getFamilyName().getFn1_Surname().setValue(nameParts[nameParts.length - 1]);
        } else {
            pid.getPatientName(0).getGivenName().setValue(name);
        }
        if (record.getPatientDateOfBirth() != null) {
            pid.getDateTimeOfBirth().getTs1_TimeOfAnEvent().setValue(
                    record.getPatientDateOfBirth().replace("-", ""));
        }
        if (record.getPatientGender() != null) {
            pid.getAdministrativeSex().setValue(record.getPatientGender().name().substring(0, 1));
        }

        int orderIdx = 0;

        // ── Medication Orders (RxNorm coded) ──────────────────────────────────
        if (record.getStructuredMedications() != null) {
            for (MedicationAdministered med : record.getStructuredMedications()) {
                if (med == null) continue;

                ORM_O01_ORDER order = orm.getORDER(orderIdx++);

                // ORC — Common Order
                ORC orc = order.getORC();
                orc.getOrderControl().setValue("NW"); // NW = New Order
                orc.getPlacerOrderNumber().getEi1_EntityIdentifier()
                        .setValue("MED-" + System.currentTimeMillis() + "-" + orderIdx);
                orc.getOrderStatus().setValue("IP"); // IP = In Process
                orc.getDateTimeOfTransaction().getTs1_TimeOfAnEvent().setValue(
                        LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")));
                if (med.getAdministeredBy() != null) {
                    orc.getEnteredBy(0).getGivenName().setValue(med.getAdministeredBy());
                }

                // OBR — Observation Request (Medication detail)
                OBR obr = order.getORDER_DETAIL().getOBR();
                obr.getSetIDOBR().setValue(String.valueOf(orderIdx));

                // Use RxNorm code if available, otherwise medication name
                String rxCode  = med.getRxNormCode() != null ? med.getRxNormCode() : "";
                String medName = med.getMedicationName() != null ? med.getMedicationName() : "Unknown Medication";
                obr.getUniversalServiceIdentifier().getCe1_Identifier().setValue(rxCode.isBlank() ? medName : rxCode);
                obr.getUniversalServiceIdentifier().getCe2_Text().setValue(medName);
                obr.getUniversalServiceIdentifier().getCe3_NameOfCodingSystem().setValue(rxCode.isBlank() ? "L" : "RXNORM");

                if (med.getAdministeredAt() != null) {
                    obr.getObservationDateTime().getTs1_TimeOfAnEvent().setValue(
                            med.getAdministeredAt().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")));
                }
                // Dosage in quantity field
                if (med.getDosage() != null) {
                    obr.getQuantityTiming(0).getQuantity().getQuantity().setValue(String.valueOf(med.getDosage()));
                    if (med.getUnit() != null) {
                        obr.getQuantityTiming(0).getQuantity().getUnits().getCe1_Identifier().setValue(med.getUnit());
                    }
                }
                // Route of administration
                if (med.getRoute() != null) {
                    obr.getResultStatus().setValue("F");
                }

                log.debug("ORM^O01 — Added medication order: {} (RxNorm: {})", medName, rxCode);
            }
        }

        // ── Procedure Orders (SNOMED-CT coded) ────────────────────────────────
        if (record.getStructuredProcedures() != null) {
            for (ProcedurePerformed proc : record.getStructuredProcedures()) {
                if (proc == null) continue;

                ORM_O01_ORDER order = orm.getORDER(orderIdx++);

                // ORC — Common Order
                ORC orc = order.getORC();
                orc.getOrderControl().setValue("NW"); // NW = New Order
                orc.getPlacerOrderNumber().getEi1_EntityIdentifier()
                        .setValue("PROC-" + System.currentTimeMillis() + "-" + orderIdx);
                orc.getOrderStatus().setValue("CM"); // CM = Completed
                orc.getDateTimeOfTransaction().getTs1_TimeOfAnEvent().setValue(
                        LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")));
                if (proc.getPerformedBy() != null) {
                    orc.getEnteredBy(0).getGivenName().setValue(proc.getPerformedBy());
                }

                // OBR — Observation Request (Procedure detail)
                OBR obr = order.getORDER_DETAIL().getOBR();
                obr.getSetIDOBR().setValue(String.valueOf(orderIdx));

                // Use SNOMED code if available, otherwise procedure name
                String snomedCode = proc.getSnomedCode() != null ? proc.getSnomedCode() : "";
                String procName   = proc.getProcedureName() != null ? proc.getProcedureName() : "Unknown Procedure";
                obr.getUniversalServiceIdentifier().getCe1_Identifier().setValue(snomedCode.isBlank() ? procName : snomedCode);
                obr.getUniversalServiceIdentifier().getCe2_Text().setValue(procName);
                obr.getUniversalServiceIdentifier().getCe3_NameOfCodingSystem().setValue(snomedCode.isBlank() ? "L" : "SCT");

                if (proc.getPerformedAt() != null) {
                    obr.getObservationDateTime().getTs1_TimeOfAnEvent().setValue(
                            proc.getPerformedAt().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")));
                }
                obr.getResultStatus().setValue(Boolean.TRUE.equals(proc.getSuccessful()) ? "F" : "X");

                log.debug("ORM^O01 — Added procedure order: {} (SNOMED: {})", procName, snomedCode);
            }
        }

        // Fallback: if no orders at all, skip encoding (return empty to avoid sending empty message)
        if (orderIdx == 0) {
            log.warn("ORM^O01 — No medications or procedures found for patient {}. Skipping order message.",
                    record.getPatientId());
            return null;
        }

        Parser parser = hapiContext.getPipeParser();
        return parser.encode(orm);
    }

    /**
     * Sends HL7 ORM^O01 order entry message to the destination hospital via MLLP.
     * Uses same dynamic routing logic as ADT and ORU messages.
     */
    @Async
    public void sendOrderMessage(PatientCareRecordDTO record) {
        if (!hl7Config.isEnabled()) {
            return;
        }
        try {
            String hl7Payload = buildOrderMessageString(record);
            if (hl7Payload == null) {
                return; // Nothing to send
            }

            String host = hl7Config.getMllp().getHost();
            int port    = hl7Config.getMllp().getPort();

            // Dynamic routing (same as ADT^A01 / ORU^R01)
            String targetFacilityId = null;
            String targetName = null;
            if (record.getTransport() != null) {
                targetFacilityId = record.getTransport().getDestinationFacilityId();
                targetName       = record.getTransport().getDestinationName();
            }
            if (targetName == null) {
                targetName = record.getTransportDestination();
            }

            java.util.Optional<com.healthcare.epcr.hl7.model.Hospital> targetHospital = java.util.Optional.empty();
            if (targetFacilityId != null && !targetFacilityId.isBlank()) {
                targetHospital = hospitalRepository.findById(targetFacilityId);
            }
            if (targetHospital.isEmpty() && targetName != null && !targetName.isBlank()) {
                targetHospital = hospitalRepository.findByNameIgnoreCase(targetName);
                if (targetHospital.isEmpty()) {
                    java.util.List<com.healthcare.epcr.hl7.model.Hospital> partialMatches =
                            hospitalRepository.findByNameContainingIgnoreCase(targetName);
                    if (!partialMatches.isEmpty()) {
                        targetHospital = java.util.Optional.of(partialMatches.get(0));
                    }
                }
            }
            if (targetHospital.isPresent()) {
                com.healthcare.epcr.hl7.model.Hospital hosp = targetHospital.get();
                if (hosp.getHl7Ip() != null && !hosp.getHl7Ip().isBlank() && hosp.getHl7Port() != null) {
                    host = hosp.getHl7Ip();
                    port = hosp.getHl7Port();
                    log.info("Dynamically routed HL7 ORM^O01 to hospital: {} ({}:{})", hosp.getName(), host, port);
                }
            } else {
                log.warn("ORM^O01 — Destination hospital not found. Falling back to default: {}:{}", host, port);
            }

            log.info("Sending HL7 ORM^O01 message for Patient ID: {} to {}:{}", record.getPatientId(), host, port);

            try (java.net.Socket socket = new java.net.Socket(host, port);
                 java.io.OutputStream out = socket.getOutputStream();
                 java.io.InputStream in   = socket.getInputStream()) {

                socket.setSoTimeout(5000); // 5-second ACK timeout

                out.write(0x0B);
                out.write(hl7Payload.getBytes("UTF-8"));
                out.write(0x1C);
                out.write(0x0D);
                out.flush();

                log.info("HL7 ORM^O01 message sent successfully, awaiting ACK...");
                readAndProcessAck(in, "ORM^O01");
            }
        } catch (Exception e) {
            log.error("Failed to send HL7 ORM^O01 order entry message", e);
        }
    }

    @PreDestroy
    public void cleanup() {
        log.info("Cleaning up HL7 Outbound Sender resources...");
        try {
            if (hapiContext != null) {
                hapiContext.close();
            }
        } catch (IOException e) {
            log.error("Failed to close HapiContext", e);
        }
    }
}
