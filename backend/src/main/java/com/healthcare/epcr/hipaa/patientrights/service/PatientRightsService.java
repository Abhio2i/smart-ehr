package com.healthcare.epcr.hipaa.patientrights.service;

import com.healthcare.epcr.epcr.model.PatientCareRecord;
import com.healthcare.epcr.epcr.repository.PatientCareRecordRepository;
import com.healthcare.epcr.hipaa.disclosure.model.DisclosureLog;
import com.healthcare.epcr.hipaa.disclosure.service.DisclosureService;
import com.healthcare.epcr.hipaa.patientrights.dto.CreateAmendmentRequest;
import com.healthcare.epcr.hipaa.patientrights.dto.CreateDisclosureRestrictionRequest;
import com.healthcare.epcr.hipaa.patientrights.model.AmendmentRequest;
import com.healthcare.epcr.hipaa.patientrights.model.DisclosureRestriction;
import com.healthcare.epcr.hipaa.patientrights.repository.AmendmentRequestRepository;
import com.healthcare.epcr.hipaa.patientrights.repository.DisclosureRestrictionRepository;
import com.healthcare.epcr.organization.dto.OrganizationDTO;
import com.healthcare.epcr.organization.service.OrganizationConfigCacheService;
import com.healthcare.epcr.phi.crypto.PhiCryptoService;
import com.healthcare.epcr.security.AccessControlService;
import com.healthcare.epcr.user.repository.UserRepository;
import com.healthcare.epcr.notification.model.Notification;
import com.healthcare.epcr.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class PatientRightsService {
    private final AmendmentRequestRepository amendmentRequestRepository;
    private final DisclosureRestrictionRepository disclosureRestrictionRepository;
    private final PatientCareRecordRepository recordRepository;
    private final DisclosureService disclosureService;
    private final AccessControlService accessControlService;
    private final PhiCryptoService phiCryptoService;
    private final UserRepository userRepository;
    private final OrganizationConfigCacheService organizationConfigCacheService;
    private final NotificationService notificationService;

    public List<PatientCareRecord> getPatientPortalRecords(String organizationId, String patientId) {
        if (patientId != null) {
            patientId = patientId.trim().toUpperCase(java.util.Locale.ROOT);
        }
        return recordRepository.findByPatientId(patientId)
                .stream()
                .filter(r -> organizationId.equals(r.getOrganizationId()))
                .map(this::copyWithDecryptedPhi)
                .toList();
    }

    public PatientCareRecord getPatientPortalRecordById(String organizationId, String patientId, String recordId) {
        if (patientId != null) {
            patientId = patientId.trim().toUpperCase(java.util.Locale.ROOT);
        }
        PatientCareRecord record = recordRepository.findByIdAndPatientId(recordId, patientId)
                .orElseThrow(() -> new IllegalArgumentException("Record not found"));
        if (!organizationId.equals(record.getOrganizationId())) {
            throw new IllegalArgumentException("Access denied for organizationId: " + organizationId);
        }
        return copyWithDecryptedPhi(record);
    }

    public AmendmentRequest createAmendment(CreateAmendmentRequest request) {
        accessControlService.assertOrganizationAccess(request.getOrganizationId());
        AmendmentRequest amendment = new AmendmentRequest();
        amendment.setOrganizationId(request.getOrganizationId());
        String pId = request.getPatientId();
        if (pId != null) {
            pId = pId.trim().toUpperCase(java.util.Locale.ROOT);
        }
        amendment.setPatientId(pId);
        amendment.setRecordId(request.getRecordId());
        amendment.setRequestedChanges(request.getRequestedChanges());
        amendment.setReason(request.getReason());
        amendment.setStatus("SUBMITTED");
        amendment.setCreatedAt(LocalDateTime.now());
        amendment.setUpdatedAt(LocalDateTime.now());
        AmendmentRequest saved = amendmentRequestRepository.save(amendment);

        // Notify Admins/Physicians
        Notification notification = new Notification();
        notification.setRecipientId(null); // System-wide or org-wide (logic in notification service handles broadcast if needed, but here we might need specific target)
        notification.setType("INFO");
        notification.setTitle("New Amendment Request");
        notification.setMessage("A new amendment request has been submitted for record: " + request.getRecordId());
        notification.setRelatedEntityId(saved.getId());
        notification.setRelatedEntityType("AmendmentRequest");
        // For now, we'll notify the organization admins if needed, but the simple way is to at least have the record
        // In this system, notifications usually target specific users. 
        // We'll skip the 'broadcast' for now unless we have a specific recipient.
        
        return saved;
    }

    public List<AmendmentRequest> listAmendments(String patientId) {
        if (patientId != null) {
            patientId = patientId.trim().toUpperCase(java.util.Locale.ROOT);
        }
        return amendmentRequestRepository.findByPatientIdOrderByCreatedAtDesc(patientId);
    }


    public DisclosureRestriction createRestriction(CreateDisclosureRestrictionRequest request) {
        accessControlService.assertOrganizationAccess(request.getOrganizationId());
        DisclosureRestriction restriction = new DisclosureRestriction();
        restriction.setOrganizationId(request.getOrganizationId());
        String pId = request.getPatientId();
        if (pId != null) {
            pId = pId.trim().toUpperCase(java.util.Locale.ROOT);
        }
        restriction.setPatientId(pId);
        restriction.setRestrictionType(request.getRestrictionType());
        restriction.setFields(request.getFields());
        // If caller is a patient principal, use the patientId as the requester; otherwise use the authenticated user's id
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof com.healthcare.epcr.patient.security.PatientPrincipal) {
            restriction.setRequestedBy(pId);
        } else {
            restriction.setRequestedBy(accessControlService.currentUser().getId());
        }
        restriction.setStatus("SUBMITTED");
        restriction.setCreatedAt(LocalDateTime.now());
        restriction.setUpdatedAt(LocalDateTime.now());
        return disclosureRestrictionRepository.save(restriction);
    }

    public List<DisclosureRestriction> listRestrictions(String patientId) {
        if (patientId != null) {
            patientId = patientId.trim().toUpperCase(java.util.Locale.ROOT);
        }
        return disclosureRestrictionRepository.findByPatientIdOrderByCreatedAtDesc(patientId);
    }


    public List<DisclosureLog> getPatientDisclosures(String patientId) {
        if (patientId != null) {
            patientId = patientId.trim().toUpperCase(java.util.Locale.ROOT);
        }
        return disclosureService.listByPatient(patientId);
    }

    private PatientCareRecord copyWithDecryptedPhi(PatientCareRecord source) {
        if (source == null) return null;
        PatientCareRecord copy = new PatientCareRecord();
        copy.setId(source.getId());
        copy.setPatientId(source.getPatientId());
        copy.setPatientName(phiCryptoService.decrypt(source.getPatientName()));
        copy.setPatientDateOfBirth(phiCryptoService.decrypt(source.getPatientDateOfBirth()));
        copy.setPatientGender(source.getPatientGender());
        copy.setPatientPhone(phiCryptoService.decrypt(source.getPatientPhone()));
        copy.setPatientAddress(phiCryptoService.decrypt(source.getPatientAddress()));
        copy.setPatientSSNLast4(phiCryptoService.decrypt(source.getPatientSSNLast4()));
        copy.setMedicalHistory(source.getMedicalHistory());
        copy.setHeight(source.getHeight());
        copy.setWeight(source.getWeight());
        copy.setAge(source.getAge());
        copy.setEmail(phiCryptoService.decrypt(source.getEmail()));
        copy.setBloodGroup(phiCryptoService.decrypt(source.getBloodGroup()));
        copy.setSpo2(source.getSpo2());
        copy.setRespirationRate(source.getRespirationRate());
        copy.setBloodSugar(source.getBloodSugar());
        copy.setHeartRate(source.getHeartRate());
        copy.setDiastolicBp(source.getDiastolicBp());
        copy.setSystolicBp(source.getSystolicBp());
        copy.setPulseRate(source.getPulseRate());
        copy.setTemperature(source.getTemperature());
        copy.setHemoglobin(source.getHemoglobin());
        copy.setComorbidity(phiCryptoService.decrypt(source.getComorbidity()));
        copy.setAllergy(phiCryptoService.decrypt(source.getAllergy()));
        copy.setDoctor(phiCryptoService.decrypt(source.getDoctor()));
        copy.setCurrentMedicines(phiCryptoService.decrypt(source.getCurrentMedicines()));
        copy.setIncidentDateTime(source.getIncidentDateTime());
        copy.setIncidentLocation(phiCryptoService.decrypt(source.getIncidentLocation()));
        copy.setIncidentDescription(phiCryptoService.decrypt(source.getIncidentDescription()));
        copy.setIncidentType(source.getIncidentType());
        copy.setIncidentNumber(source.getIncidentNumber());
        copy.setSceneAssessment(source.getSceneAssessment());
        copy.setCrew(source.getCrew());
        copy.setTimeline(source.getTimeline());
        copy.setParamedicsId(source.getParamedicsId());
        copy.setOrganizationId(source.getOrganizationId());
        copy.setComplaints(phiCryptoService.decryptList(source.getComplaints()));
        copy.setVitals(phiCryptoService.decryptList(source.getVitals()));
        copy.setStructuredComplaints(source.getStructuredComplaints());
        copy.setStructuredVitals(source.getStructuredVitals());
        copy.setDiagnosis(phiCryptoService.decrypt(source.getDiagnosis()));
        copy.setTreatmentProvided(phiCryptoService.decrypt(source.getTreatmentProvided()));
        copy.setTreatmentPlan(phiCryptoService.decrypt(source.getTreatmentPlan()));
        copy.setTransportDestination(phiCryptoService.decrypt(source.getTransportDestination()));
        copy.setTransportMode(source.getTransportMode());
        copy.setCareLevel(source.getCareLevel());
        copy.setIcd10Code(source.getIcd10Code());
        copy.setPrimaryImpression(source.getPrimaryImpression());
        copy.setSecondaryImpression(source.getSecondaryImpression());
        copy.setMedicationsAdministered(phiCryptoService.decryptList(source.getMedicationsAdministered()));
        copy.setProceduresPerformed(phiCryptoService.decryptList(source.getProceduresPerformed()));
        copy.setStructuredMedications(source.getStructuredMedications());
        copy.setStructuredProcedures(source.getStructuredProcedures());
        copy.setTransport(source.getTransport());
        copy.setConsent(source.getConsent());
        copy.setClinicalData(source.getClinicalData());
        copy.setStatus(source.getStatus());
        copy.setCreatedAt(source.getCreatedAt());
        copy.setUpdatedAt(source.getUpdatedAt());
        copy.setSubmittedAt(source.getSubmittedAt());
        copy.setSubmittedBy(source.getSubmittedBy());
        copy.setQaApproved(source.getQaApproved());
        copy.setQaApprovedAt(source.getQaApprovedAt());
        copy.setQaApprovedBy(source.getQaApprovedBy());
        copy.setAttachmentIds(source.getAttachmentIds());
        copy.setAuditTrail(source.getAuditTrail());
        copy.setFeedback(source.getFeedback());
        Map<String, Object> dynamic = decryptDynamicFormResponses(source.getDynamicFormResponses());
        if (dynamic == null) {
            dynamic = new HashMap<>();
        }
        dynamic.put("paramedicsName", resolveUserDisplayName(source.getParamedicsId()));
        dynamic.put("organizationName", resolveOrganizationName(source.getOrganizationId()));
        dynamic.put("submittedByName", resolveUserDisplayName(source.getSubmittedBy()));
        dynamic.put("qaApprovedByName", resolveUserDisplayName(source.getQaApprovedBy()));
        copy.setDynamicFormResponses(dynamic);
        return copy;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> decryptDynamicFormResponses(Map<String, Object> source) {
        if (source == null) return null;
        Map<String, Object> output = new HashMap<>();
        for (Map.Entry<String, Object> entry : source.entrySet()) {
            output.put(entry.getKey(), decryptDynamicValue(entry.getValue()));
        }
        return output;
    }

    @SuppressWarnings("unchecked")
    private Object decryptDynamicValue(Object value) {
        if (value instanceof String s) {
            return phiCryptoService.decrypt(s);
        }
        if (value instanceof List<?> list) {
            return list.stream().map(this::decryptDynamicValue).toList();
        }
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> nested = new HashMap<>();
            for (Map.Entry<?, ?> e : map.entrySet()) {
                nested.put(String.valueOf(e.getKey()), decryptDynamicValue(e.getValue()));
            }
            return nested;
        }
        return value;
    }

    private String resolveUserDisplayName(String userId) {
        if (userId == null || userId.isBlank()) return "N/A";
        return userRepository.findById(userId)
                .map(u -> ((u.getFirstName() == null ? "" : u.getFirstName()) + " "
                        + (u.getLastName() == null ? "" : u.getLastName())).trim())
                .filter(name -> !name.isBlank())
                .orElse(userId);
    }

    private String resolveOrganizationName(String organizationId) {
        if (organizationId == null || organizationId.isBlank()) return "N/A";
        OrganizationDTO organization = organizationConfigCacheService.getOrganization(organizationId);
        return organization == null || organization.getName() == null || organization.getName().isBlank()
                ? organizationId
                : organization.getName();
    }

}
