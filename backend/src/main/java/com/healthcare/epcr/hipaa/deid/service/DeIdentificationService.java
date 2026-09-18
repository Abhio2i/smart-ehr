package com.healthcare.epcr.hipaa.deid.service;

import com.healthcare.epcr.epcr.model.PatientCareRecord;
import com.healthcare.epcr.epcr.repository.PatientCareRecordRepository;
import com.healthcare.epcr.organization.dto.OrganizationDTO;
import com.healthcare.epcr.organization.service.OrganizationConfigCacheService;
import com.healthcare.epcr.phi.crypto.PhiCryptoService;
import com.healthcare.epcr.security.AccessControlService;
import com.healthcare.epcr.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Collections;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class DeIdentificationService {
    private final PatientCareRecordRepository recordRepository;
    private final AccessControlService accessControlService;
    private final PhiCryptoService phiCryptoService;
    private final UserRepository userRepository;
    private final OrganizationConfigCacheService organizationConfigCacheService;

    public List<PatientCareRecord> listDeidentified(String organizationId) {
        accessControlService.assertOrganizationAccess(organizationId);
        return recordRepository.findByOrganizationId(organizationId)
                .stream()
                .map(this::mask)
                .toList();
    }

    public PatientCareRecord getDeidentified(String recordId) {
        PatientCareRecord record = recordRepository.findById(recordId)
                .orElseThrow(() -> new IllegalArgumentException("Record not found"));
        accessControlService.assertOrganizationAccess(record.getOrganizationId());
        return mask(record);
    }

    public List<PatientCareRecord> listDeidentifiedByPatient(String organizationId, String patientId) {
        accessControlService.assertOrganizationAccess(organizationId);
        return recordRepository.findByPatientId(patientId)
                .stream()
                .filter(r -> organizationId.equals(r.getOrganizationId()))
                .map(this::mask)
                .toList();
    }

    public List<PatientCareRecord> listDeidentifiedByRecordId(String recordId) {
        return Collections.singletonList(getDeidentified(recordId));
    }

    private PatientCareRecord mask(PatientCareRecord record) {
        PatientCareRecord decrypted = decryptPhi(record);
        String paramedicName = resolveUserDisplayName(decrypted.getParamedicsId());
        String submittedByName = resolveUserDisplayName(decrypted.getSubmittedBy());
        String organizationName = resolveOrganizationDisplayName(decrypted.getOrganizationId());
        PatientCareRecord copy = new PatientCareRecord();
        copy.setId(decrypted.getId());
        copy.setPatientId(decrypted.getPatientId());
        copy.setOrganizationId(formatIdWithName(decrypted.getOrganizationId(), organizationName));
        copy.setIncidentDateTime(decrypted.getIncidentDateTime());
        copy.setIncidentType(decrypted.getIncidentType());
        copy.setStatus(decrypted.getStatus());
        copy.setCareLevel(decrypted.getCareLevel());
        copy.setTransportMode(decrypted.getTransportMode());
        copy.setQaApproved(decrypted.getQaApproved());
        copy.setQaApprovedAt(decrypted.getQaApprovedAt());
        copy.setQaApprovedBy(decrypted.getQaApprovedBy());
        copy.setSubmittedAt(decrypted.getSubmittedAt());
        copy.setSubmittedBy(formatIdWithName(decrypted.getSubmittedBy(), submittedByName));
        copy.setCreatedAt(decrypted.getCreatedAt());
        copy.setUpdatedAt(decrypted.getUpdatedAt());
        copy.setPatientGender(decrypted.getPatientGender());
        copy.setParamedicsId(formatIdWithName(decrypted.getParamedicsId(), paramedicName));
        copy.setTransportDestination(decrypted.getTransportDestination());
        copy.setPatientName("REDACTED");
        copy.setPatientDateOfBirth(null);
        copy.setPatientPhone(null);
        copy.setPatientAddress(null);
        copy.setDiagnosis("REDACTED");
        copy.setTreatmentProvided("REDACTED");
        copy.setTreatmentPlan("REDACTED");
        copy.setIncidentDescription("REDACTED");
        copy.setIncidentLocation("REDACTED");
        copy.setComplaints(decrypted.getComplaints());
        copy.setVitals(decrypted.getVitals());
        copy.setMedicationsAdministered(decrypted.getMedicationsAdministered());
        copy.setProceduresPerformed(decrypted.getProceduresPerformed());
        copy.setClinicalData(decrypted.getClinicalData());
        copy.setAttachmentIds(decrypted.getAttachmentIds());
        copy.setDynamicFormResponses(enrichDisplayMetadata(decrypted, paramedicName, submittedByName, organizationName));
        copy.setFeedback(decrypted.getFeedback());
        return copy;
    }

    private Map<String, Object> enrichDisplayMetadata(PatientCareRecord record, String paramedicName, String submittedByName, String organizationName) {
        Map<String, Object> base = new HashMap<>();
        if (record.getDynamicFormResponses() != null) {
            base.putAll(record.getDynamicFormResponses());
        }
        base.put("paramedicsName", paramedicName);
        base.put("submittedByName", submittedByName);
        base.put("organizationName", organizationName);
        // Debug log so we can confirm these keys are present in the response
        if (log.isDebugEnabled()) {
            try {
                log.debug("Enriched dynamicFormResponses for record {} -> keys: {}", record.getId(), base.keySet());
                log.trace("Enriched dynamicFormResponses for record {} -> full map: {}", record.getId(), base);
            } catch (Exception e) {
                log.warn("Failed to log enriched dynamicFormResponses for record {}", record.getId(), e);
            }
        }
        return base;
    }

    private String resolveUserDisplayName(String userId) {
        if (userId == null || userId.isBlank()) return "N/A";
        return userRepository.findById(userId)
                .map(u -> ((u.getFirstName() == null ? "" : u.getFirstName()) + " " + (u.getLastName() == null ? "" : u.getLastName())).trim())
                .filter(s -> !s.isBlank())
                .orElse("N/A");
    }

    private String resolveOrganizationDisplayName(String organizationId) {
        if (organizationId == null || organizationId.isBlank()) return "N/A";
        OrganizationDTO organization = organizationConfigCacheService.getOrganization(organizationId);
        return organization == null || organization.getName() == null || organization.getName().isBlank()
                ? "N/A"
                : organization.getName();
    }

    private String formatIdWithName(String id, String name) {
        if (id == null || id.isBlank()) return "N/A";
        if (name == null || name.isBlank() || "N/A".equals(name)) return id;
        return id + " (" + name + ")";
    }

    private PatientCareRecord decryptPhi(PatientCareRecord record) {
        if (record == null) {
            return null;
        }
        PatientCareRecord copy = new PatientCareRecord();
        copy.setId(record.getId());
        copy.setPatientId(record.getPatientId());
        copy.setPatientName(phiCryptoService.decrypt(record.getPatientName()));
        copy.setPatientDateOfBirth(phiCryptoService.decrypt(record.getPatientDateOfBirth()));
        copy.setPatientGender(record.getPatientGender());
        copy.setPatientPhone(phiCryptoService.decrypt(record.getPatientPhone()));
        copy.setPatientAddress(phiCryptoService.decrypt(record.getPatientAddress()));
        copy.setIncidentDateTime(record.getIncidentDateTime());
        copy.setIncidentLocation(phiCryptoService.decrypt(record.getIncidentLocation()));
        copy.setIncidentDescription(phiCryptoService.decrypt(record.getIncidentDescription()));
        copy.setIncidentType(record.getIncidentType());
        copy.setParamedicsId(record.getParamedicsId());
        copy.setOrganizationId(record.getOrganizationId());
        copy.setComplaints(phiCryptoService.decryptList(record.getComplaints()));
        copy.setVitals(phiCryptoService.decryptList(record.getVitals()));
        copy.setDiagnosis(phiCryptoService.decrypt(record.getDiagnosis()));
        copy.setTreatmentProvided(phiCryptoService.decrypt(record.getTreatmentProvided()));
        copy.setTreatmentPlan(phiCryptoService.decrypt(record.getTreatmentPlan()));
        copy.setTransportDestination(phiCryptoService.decrypt(record.getTransportDestination()));
        copy.setTransportMode(record.getTransportMode());
        copy.setCareLevel(record.getCareLevel());
        copy.setMedicationsAdministered(phiCryptoService.decryptList(record.getMedicationsAdministered()));
        copy.setProceduresPerformed(phiCryptoService.decryptList(record.getProceduresPerformed()));
        copy.setClinicalData(record.getClinicalData());
        copy.setStatus(record.getStatus());
        copy.setCreatedAt(record.getCreatedAt());
        copy.setUpdatedAt(record.getUpdatedAt());
        copy.setSubmittedAt(record.getSubmittedAt());
        copy.setSubmittedBy(record.getSubmittedBy());
        copy.setQaApproved(record.getQaApproved());
        copy.setQaApprovedAt(record.getQaApprovedAt());
        copy.setQaApprovedBy(record.getQaApprovedBy());
        copy.setAttachmentIds(record.getAttachmentIds());
        copy.setFeedback(record.getFeedback());
        copy.setDynamicFormResponses(record.getDynamicFormResponses());
        return copy;
    }
}
