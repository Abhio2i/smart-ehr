package com.healthcare.epcr.hipaa.consent.service;

import com.healthcare.epcr.hipaa.consent.dto.CreateConsentRequest;
import com.healthcare.epcr.hipaa.consent.model.PatientConsent;
import com.healthcare.epcr.hipaa.consent.repository.PatientConsentRepository;
import com.healthcare.epcr.security.AccessControlService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PatientConsentService {
    private final PatientConsentRepository repository;
    private final AccessControlService accessControlService;

    public PatientConsent create(String patientId, String organizationId, String actorUserId, CreateConsentRequest request) {
        accessControlService.assertOrganizationAccess(organizationId);
        PatientConsent consent = new PatientConsent();
        consent.setPatientId(patientId);
        consent.setOrganizationId(organizationId);
        consent.setConsentType(request.getConsentType());
        consent.setStatus("GRANTED");
        consent.setEffectiveFrom(request.getEffectiveFrom() != null ? request.getEffectiveFrom() : LocalDateTime.now());
        consent.setEffectiveTo(request.getEffectiveTo());
        consent.setDataCategories(request.getDataCategories());
        consent.setRecipientTypes(request.getRecipientTypes());
        consent.setCaptureMethod(request.getCaptureMethod());
        consent.setDocumentRef(request.getDocumentRef());
        consent.setCapturedByUserId(actorUserId);
        consent.setCreatedAt(LocalDateTime.now());
        consent.setUpdatedAt(LocalDateTime.now());
        return repository.save(consent);
    }

    public List<PatientConsent> listByPatient(String patientId) {
        return repository.findByPatientIdOrderByCreatedAtDesc(patientId);
    }

    public List<PatientConsent> listByOrganization(String organizationId) {
        accessControlService.assertOrganizationAccess(organizationId);
        return repository.findByOrganizationIdOrderByCreatedAtDesc(organizationId);
    }


    public PatientConsent getById(String patientId, String consentId) {
        return repository.findByIdAndPatientId(consentId, patientId)
                .orElseThrow(() -> new IllegalArgumentException("Consent not found"));
    }

    public PatientConsent revoke(String patientId, String consentId) {
        PatientConsent consent = getById(patientId, consentId);
        consent.setStatus("REVOKED");
        consent.setUpdatedAt(LocalDateTime.now());
        return repository.save(consent);
    }
}
