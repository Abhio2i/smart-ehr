package com.healthcare.epcr.hipaa.disclosure.service;

import com.healthcare.epcr.hipaa.disclosure.dto.CreateDisclosureRequest;
import com.healthcare.epcr.hipaa.disclosure.model.DisclosureLog;
import com.healthcare.epcr.hipaa.disclosure.repository.DisclosureLogRepository;
import com.healthcare.epcr.security.AccessControlService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DisclosureService {
    private final DisclosureLogRepository repository;
    private final AccessControlService accessControlService;

    public DisclosureLog create(CreateDisclosureRequest request) {
        accessControlService.assertOrganizationAccess(request.getOrganizationId());
        DisclosureLog log = new DisclosureLog();
        log.setOrganizationId(request.getOrganizationId());
        log.setPatientId(request.getPatientId());
        log.setRecordId(request.getRecordId());
        log.setDisclosedByUserId(accessControlService.currentUser().getId());
        log.setRecipientType(request.getRecipientType());
        log.setRecipientName(request.getRecipientName());
        log.setPurpose(request.getPurpose());
        log.setDataElements(request.getDataElements());
        log.setLegalBasis(request.getLegalBasis());
        log.setConsentId(request.getConsentId());
        log.setMethod(request.getMethod());
        log.setRequestId(request.getRequestId());
        log.setDisclosedAt(LocalDateTime.now());
        return repository.save(log);
    }

    public List<DisclosureLog> listByPatient(String patientId) {
        return repository.findByPatientIdOrderByDisclosedAtDesc(patientId);
    }

    public List<DisclosureLog> listByOrganization(String organizationId) {
        accessControlService.assertOrganizationAccess(organizationId);
        return repository.findByOrganizationIdOrderByDisclosedAtDesc(organizationId);
    }
}

