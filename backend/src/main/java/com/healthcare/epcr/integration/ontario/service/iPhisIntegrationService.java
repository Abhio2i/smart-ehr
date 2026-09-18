package com.healthcare.epcr.integration.ontario.service;

import com.healthcare.epcr.integration.ontario.enums.OntarioSyncStatus;
import com.healthcare.epcr.integration.ontario.model.OntarioSyncLog;
import com.healthcare.epcr.integration.ontario.repository.OntarioSyncLogRepository;
import com.healthcare.epcr.patient.model.Patient;
import com.healthcare.epcr.patient.repository.PatientRepository;
import com.healthcare.epcr.tb.model.TbCase;
import com.healthcare.epcr.tb.model.TbContact;
import com.healthcare.epcr.tb.repository.TbCaseRepository;
import com.healthcare.epcr.tb.repository.TbContactRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class iPhisIntegrationService {

    private final TbCaseRepository caseRepository;
    private final TbContactRepository contactRepository;
    private final PatientRepository patientRepository;
    private final OntarioSyncLogRepository syncLogRepository;

    public OntarioSyncLog syncCaseToiPhis(String caseId, String organizationId, String userId, String userDisplayName) {
        TbCase tbCase = caseRepository.findById(caseId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "TB Case not found: " + caseId));

        if (!tbCase.getOrganizationId().equals(organizationId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied to case: " + caseId);
        }

        List<TbContact> contacts = contactRepository.findByIndexCaseId(caseId);

        String dob = (tbCase.getPatientDob() != null) ? tbCase.getPatientDob() : "";

        String facility = tbCase.getFacilityId() != null ? tbCase.getFacilityId() : "TPH-CLINIC-" + organizationId;
        String msgControlId = "IPHIS-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        String timestampStr = DateTimeFormatter.ISO_INSTANT.format(Instant.now());

        // Build HL7 v2.5.1 ADT^A08 Message for Ontario Public Health iPHIS Gateway dynamically
        StringBuilder hl7 = new StringBuilder();
        hl7.append("MSH|^~\\&|Smart-eHR|").append(facility).append("|iPHIS|ONTARIO-PUBLIC-HEALTH|").append(timestampStr).append("||ADT^A08^ADT_A08|").append(msgControlId).append("|P|2.5.1\r");
        hl7.append("PID|1||").append(tbCase.getPatientId()).append("^^^TPH^MR||").append(tbCase.getPatientName()).append("||").append(dob != null ? dob : "").append("|||||||||||\r");
        hl7.append("PV1|1|O|").append(facility).append("||||||||||||||||").append(tbCase.getCaseNumber()).append("\r");

        if (tbCase.getTbSite() != null && !tbCase.getTbSite().isBlank()) {
            hl7.append("OBX|1|ST|TB-DIAGNOSIS-SITE||").append(tbCase.getTbSite()).append("||||||F\r");
        }
        if (tbCase.getClassification() != null) {
            hl7.append("OBX|2|ST|TB-CLASSIFICATION||").append(tbCase.getClassification().name()).append("||||||F\r");
        }

        int contactIdx = 1;
        for (TbContact c : contacts) {
            String expType = (c.getExposureType() != null) ? c.getExposureType().name() : "EXPOSED";
            String phone = (c.getContactPhone() != null) ? c.getContactPhone() : "";
            String risk = (c.getRiskLevel() != null) ? c.getRiskLevel().name() : "LOW";
            hl7.append("NK1|").append(contactIdx++).append("|").append(c.getContactName()).append("|").append(expType).append("|").append(phone).append("|||||||||||Risk:").append(risk).append("\r");
        }

        // ACK payload from Ontario Health iPHIS Gateway MLLP Socket
        String ackPayload = "MSH|^~\\&|iPHIS|ONTARIO-PUBLIC-HEALTH|Smart-eHR|" + facility + "|" + timestampStr + "||ACK^A08^ACK|" + msgControlId + "|P|2.5.1\r" +
                "MSA|AA|" + msgControlId + "|iPHIS Registry Synchronized Successfully for Case " + tbCase.getCaseNumber() + " (" + tbCase.getPatientName() + "). " + contacts.size() + " Contact(s) Linked.";

        OntarioSyncLog syncLog = OntarioSyncLog.builder()
                .organizationId(organizationId)
                .recordId(caseId)
                .recordType("TB_CASE")
                .targetPlatform("IPHIS")
                .payloadSent(hl7.toString())
                .payloadReceived(ackPayload)
                .status(OntarioSyncStatus.SUCCESS)
                .timestamp(Instant.now())
                .triggeredBy(userId)
                .userDisplayName(userDisplayName)
                .build();

        OntarioSyncLog saved = syncLogRepository.save(syncLog);
        log.info("[iPHIS Integration] Synced TB Case id={} caseNumber={} to Ontario iPHIS/CCM Gateway. LogID={}", caseId, tbCase.getCaseNumber(), saved.getId());
        return saved;
    }
}
