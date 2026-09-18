package com.healthcare.epcr.hipaa.breakglass.service;

import com.healthcare.epcr.hipaa.breakglass.model.BreakGlassEvent;
import com.healthcare.epcr.hipaa.breakglass.repository.BreakGlassRepository;
import com.healthcare.epcr.security.AccessControlService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class BreakGlassService {
    private final BreakGlassRepository repository;
    private final AccessControlService accessControlService;

    public BreakGlassEvent start(String organizationId, String patientId, String justification, int ttlMinutes) {
        accessControlService.assertOrganizationAccess(organizationId);
        BreakGlassEvent event = new BreakGlassEvent();
        event.setOrganizationId(organizationId);
        event.setPatientId(patientId);
        event.setUserId(accessControlService.currentUser().getId());
        event.setJustification(justification);
        event.setStartedAt(LocalDateTime.now());
        event.setExpiresAt(LocalDateTime.now().plusMinutes(Math.max(ttlMinutes, 1)));
        event.setStatus("ACTIVE");
        return repository.save(event);
    }

    public BreakGlassEvent end(String id) {
        BreakGlassEvent event = repository.findById(id).orElseThrow(() -> new IllegalArgumentException("Break-glass event not found"));
        event.setEndedAt(LocalDateTime.now());
        event.setStatus("CLOSED");
        return repository.save(event);
    }

    public List<BreakGlassEvent> active() {
        return repository.findByStatusOrderByStartedAtDesc("ACTIVE");
    }

    public List<BreakGlassEvent> history(String organizationId) {
        accessControlService.assertOrganizationAccess(organizationId);
        return repository.findByOrganizationIdOrderByStartedAtDesc(organizationId);
    }
}

