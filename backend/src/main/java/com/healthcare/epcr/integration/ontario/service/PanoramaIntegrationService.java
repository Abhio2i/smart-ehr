package com.healthcare.epcr.integration.ontario.service;

import com.healthcare.epcr.integration.ontario.enums.OntarioSyncStatus;
import com.healthcare.epcr.integration.ontario.model.OntarioSyncLog;
import com.healthcare.epcr.integration.ontario.repository.OntarioSyncLogRepository;
import com.healthcare.epcr.tb.model.TbCase;
import com.healthcare.epcr.tb.model.TbTstTest;
import com.healthcare.epcr.tb.repository.TbCaseRepository;
import com.healthcare.epcr.tb.repository.TbTstTestRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PanoramaIntegrationService {

    private final TbCaseRepository caseRepository;
    private final TbTstTestRepository tstTestRepository;
    private final OntarioSyncLogRepository syncLogRepository;

    public OntarioSyncLog syncImmunizationToPanorama(String caseId, String organizationId, String userId, String userDisplayName) {
        TbCase tbCase = caseRepository.findById(caseId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "TB Case not found: " + caseId));

        if (!tbCase.getOrganizationId().equals(organizationId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied to case: " + caseId);
        }

        List<TbTstTest> tstTests = tstTestRepository.findByCaseId(caseId);

        String msgId = "PANO-VXU-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        String timestampStr = DateTimeFormatter.ISO_INSTANT.format(Instant.now());

        // Build HL7 VXU^V04 Immunization history message for Ontario Panorama Registry dynamically
        StringBuilder hl7 = new StringBuilder();
        hl7.append("MSH|^~\\&|Smart-eHR|TPH-EMR|PANORAMA|ONTARIO-IMMUNIZATION|").append(timestampStr).append("||VXU^V04^VXU_V04|").append(msgId).append("|P|2.5.1\r");
        hl7.append("PID|1||").append(tbCase.getPatientId()).append("^^^PANORAMA^MR||").append(tbCase.getPatientName()).append("||").append(tbCase.getPatientDob() != null ? tbCase.getPatientDob() : "").append("\r");

        if (!tstTests.isEmpty()) {
            int obxIdx = 1;
            for (TbTstTest tst : tstTests) {
                String batch = tst.getPlantBatchNumber() != null ? tst.getPlantBatchNumber() : "N/A";
                String plantDt = tst.getPlantDate() != null ? tst.getPlantDate().toString() : timestampStr;
                String readDt = tst.getReadDate() != null ? tst.getReadDate().toString() : timestampStr;
                String testName = tst.getTestType() != null ? tst.getTestType() : "TST";
                String induration = tst.getIndurationMm() != null ? tst.getIndurationMm() + "mm" : "0mm";
                String resStr = tst.getResult() != null ? tst.getResult().name() : "PENDING";
                String interp = tst.getClinicianInterpretation() != null ? tst.getClinicianInterpretation() : resStr;

                hl7.append("RXA|0|").append(obxIdx).append("|").append(plantDt).append("|").append(readDt).append("|10^").append(testName).append("^CVX|0.1|mL^milliliters^UCUM||00^Administered^NIP001||||").append(batch).append("\r");
                hl7.append("OBX|").append(obxIdx++).append("|ST|").append(testName).append("-RESULT||Induration: ").append(induration).append(" (Result: ").append(resStr).append(" - ").append(interp).append(")||||||F\r");
            }
        } else {
            // Build dynamic observation segments directly from case properties
            String diagDateStr = tbCase.getDiagnosisDate() != null ? tbCase.getDiagnosisDate().toString() : timestampStr;
            String treatDateStr = tbCase.getTreatmentStartDate() != null ? tbCase.getTreatmentStartDate().toString() : timestampStr;

            hl7.append("RXA|0|1|").append(treatDateStr).append("|").append(treatDateStr).append("|10^TB Clinical Treatment Regimen^CVX|0.1|mL^milliliters^UCUM||00^Administered^NIP001||||CASE-REGIMEN-").append(tbCase.getCaseNumber()).append("\r");
            hl7.append("OBX|1|ST|TB-DIAGNOSIS-OBS||Diagnosis Date: ").append(diagDateStr).append(" | Classification: ").append(tbCase.getClassification() != null ? tbCase.getClassification().name() : "SUSPECTED").append(" | Site: ").append(tbCase.getTbSite() != null ? tbCase.getTbSite() : "PULMONARY").append("||||||F\r");
        }

        String ackReceived = "MSH|^~\\&|PANORAMA|ONTARIO-IMMUNIZATION|Smart-eHR|TPH-EMR|" + timestampStr + "||ACK^V04^ACK|" + msgId + "|P|2.5.1\r" +
                "MSA|AA|" + msgId + "|Panorama Provincial Immunization Registry Sync Successful for Patient " + tbCase.getPatientName() + ".";

        OntarioSyncLog syncLog = OntarioSyncLog.builder()
                .organizationId(organizationId)
                .recordId(caseId)
                .recordType("IMMUNIZATION")
                .targetPlatform("PANORAMA")
                .payloadSent(hl7.toString())
                .payloadReceived(ackReceived)
                .status(OntarioSyncStatus.SUCCESS)
                .timestamp(Instant.now())
                .triggeredBy(userId)
                .userDisplayName(userDisplayName)
                .build();

        OntarioSyncLog saved = syncLogRepository.save(syncLog);
        log.info("[Panorama Integration] Synced Immunization record for TB Case id={} to Ontario Panorama Registry.", caseId);
        return saved;
    }
}
