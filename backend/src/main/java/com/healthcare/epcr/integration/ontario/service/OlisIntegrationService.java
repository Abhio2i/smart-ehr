package com.healthcare.epcr.integration.ontario.service;

import com.healthcare.epcr.integration.ontario.enums.OntarioSyncStatus;
import com.healthcare.epcr.integration.ontario.model.OntarioSyncLog;
import com.healthcare.epcr.integration.ontario.repository.OntarioSyncLogRepository;
import com.healthcare.epcr.tb.model.TbCase;
import com.healthcare.epcr.tb.repository.TbCaseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class OlisIntegrationService {

    private final TbCaseRepository caseRepository;
    private final OntarioSyncLogRepository syncLogRepository;

    private static final Map<String, String> LOINC_MAP = new HashMap<>();
    static {
        LOINC_MAP.put("543-9", "Acid Fast Stain - Sputum Smear");
        LOINC_MAP.put("634-6", "Mycobacterium tuberculosis Culture");
        LOINC_MAP.put("41852-5", "Mycobacterium Tuberculosis DNA PCR");
    }

    public OntarioSyncLog ingestOlisLabResult(String caseId, String sampleNumber, String result, String loincCode, String organizationId, String userId, String userDisplayName) {
        TbCase tbCase = caseRepository.findById(caseId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "TB Case not found: " + caseId));

        if (!tbCase.getOrganizationId().equals(organizationId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied to case: " + caseId);
        }

        String effectiveLoinc = (loincCode != null && !loincCode.isBlank()) ? loincCode : "543-9";
        String testDescription = LOINC_MAP.getOrDefault(effectiveLoinc, "Diagnostic Lab Specimen Test");
        LocalDate labDate = LocalDate.now();

        // Update case sputum sample tracking fields based on sample number
        if ("1".equals(sampleNumber) || "SAMPLE_1".equalsIgnoreCase(sampleNumber)) {
            tbCase.setSputumSample1Date(labDate);
            tbCase.setSputumSample1Result(result.toUpperCase());
        } else if ("2".equals(sampleNumber) || "SAMPLE_2".equalsIgnoreCase(sampleNumber)) {
            tbCase.setSputumSample2Date(labDate);
            tbCase.setSputumSample2Result(result.toUpperCase());
        } else if ("3".equals(sampleNumber) || "SAMPLE_3".equalsIgnoreCase(sampleNumber)) {
            tbCase.setSputumSample3Date(labDate);
            tbCase.setSputumSample3Result(result.toUpperCase());
        } else {
            tbCase.setSputumSample1Date(labDate);
            tbCase.setSputumSample1Result(result.toUpperCase());
        }

        tbCase.setUpdatedAt(Instant.now());
        caseRepository.save(tbCase);

        String msgId = "OLIS-LAB-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        String timestampStr = DateTimeFormatter.ISO_INSTANT.format(Instant.now());
        String facility = tbCase.getFacilityId() != null ? tbCase.getFacilityId() : "TPH-CLINIC-" + organizationId;
        String labRef = "OLIS-REF-" + tbCase.getCaseNumber() + "-S" + sampleNumber;

        // Construct incoming OLIS HL7 ORU^R01 message string dynamically
        String hl7Sent = "MSH|^~\\&|OLIS|ONTARIO-LABS|Smart-eHR|" + facility + "|" + timestampStr + "||ORU^R01^ORU_R01|" + msgId + "|P|2.5.1\r" +
                "PID|1||" + tbCase.getPatientId() + "^^^OLIS^MR||" + tbCase.getPatientName() + "||" + (tbCase.getPatientDob() != null ? tbCase.getPatientDob() : "") + "\r" +
                "OBR|1|" + msgId + "|" + labRef + "||" + effectiveLoinc + "^" + testDescription + "^LN|||" + timestampStr + "\r" +
                "OBX|1|ST|" + effectiveLoinc + "^" + testDescription + " Result||" + result.toUpperCase() + "||||||F";

        String ackReceived = "MSH|^~\\&|Smart-eHR|" + facility + "|OLIS|ONTARIO-LABS|" + timestampStr + "||ACK^R01^ACK|" + msgId + "|P|2.5.1\r" +
                "MSA|AA|" + msgId + "|OLIS Lab Feed Processed for Case " + tbCase.getCaseNumber() + " (" + tbCase.getPatientName() + "). Sputum Sample #" + sampleNumber + " updated to " + result.toUpperCase() + ".";

        OntarioSyncLog syncLog = OntarioSyncLog.builder()
                .organizationId(organizationId)
                .recordId(caseId)
                .recordType("LAB_REPORT")
                .targetPlatform("OLIS")
                .payloadSent(hl7Sent)
                .payloadReceived(ackReceived)
                .status(OntarioSyncStatus.SUCCESS)
                .timestamp(Instant.now())
                .triggeredBy(userId)
                .userDisplayName(userDisplayName)
                .build();

        OntarioSyncLog saved = syncLogRepository.save(syncLog);
        log.info("[OLIS Integration] Ingested lab result for TB Case id={} sample={} result={} LOINC={}", caseId, sampleNumber, result, effectiveLoinc);
        return saved;
    }
}
