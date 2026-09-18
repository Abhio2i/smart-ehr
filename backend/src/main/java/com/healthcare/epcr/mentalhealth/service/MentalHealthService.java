package com.healthcare.epcr.mentalhealth.service;

import com.healthcare.epcr.mentalhealth.dto.CreateMentalHealthCaseRequest;
import com.healthcare.epcr.mentalhealth.entity.MentalHealthCase;
import com.healthcare.epcr.mentalhealth.entity.MentalHealthSessionLog;
import com.healthcare.epcr.mentalhealth.repository.MentalHealthCaseRepository;
import com.healthcare.epcr.mentalhealth.repository.MentalHealthSessionLogRepository;
import com.healthcare.epcr.phi.crypto.PhiCryptoService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class MentalHealthService {

    private final MentalHealthCaseRepository caseRepository;
    private final MentalHealthSessionLogRepository sessionLogRepository;
    private final PhiCryptoService phiCryptoService;

    private static final List<MentalHealthCase.CaseStatus> ACTIVE_STATUSES = List.of(
        MentalHealthCase.CaseStatus.OPEN_INTAKE,
        MentalHealthCase.CaseStatus.ACTIVE_TREATMENT,
        MentalHealthCase.CaseStatus.CRISIS_STABILIZATION,
        MentalHealthCase.CaseStatus.RECOVERY_MAINTENANCE
    );

    public MentalHealthCase createIntake(CreateMentalHealthCaseRequest req, String organizationId, String actorId) {
        // Prevent duplicate open cases for same patient
        caseRepository.findByPatientIdAndStatusIn(req.getPatientId(), ACTIVE_STATUSES)
            .ifPresent(c -> {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Patient already has an active Mental Health case: " + c.getCaseNumber());
            });

        LocalDateTime now = LocalDateTime.now();
        String caseNumber = "MH-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        MentalHealthCase.RecoveryPlan recoveryPlan = MentalHealthCase.RecoveryPlan.builder()
            .goals(req.getGoals())
            .copingMechanisms(req.getCopingMechanisms())
            .crisisSafetyPlan(req.getCrisisSafetyPlan())
            .traditionalHealingIncluded(req.isTraditionalHealingIncluded())
            .emergencyContact(req.getEmergencyContact())
            .lastUpdated(now)
            .updatedBy(actorId)
            .build();

        MentalHealthCase mCase = MentalHealthCase.builder()
            .organizationId(organizationId)
            .patientId(req.getPatientId())
            .caseNumber(caseNumber)
            .assignedFacilityId(req.getAssignedFacilityId() != null ? req.getAssignedFacilityId() : "STH")
            .assignedProviderId(req.getAssignedProviderId())
            .admissionType(req.getAdmissionType() != null ? req.getAdmissionType() : MentalHealthCase.AdmissionType.VOLUNTARY)
            .status(MentalHealthCase.CaseStatus.OPEN_INTAKE)
            .riskLevel(req.getRiskLevel() != null ? req.getRiskLevel() : MentalHealthCase.SuicideRiskLevel.LOW)
            .riskNotes(req.getRiskNotes())
            .primarySubstance(req.getPrimarySubstance() != null ? req.getPrimarySubstance() : "NONE")
            .onOpioidAgonistTherapy(req.isOnOpioidAgonistTherapy())
            .fasdStatus(req.getFasdStatus() != null ? req.getFasdStatus() : "NOT_ASSESSED")
            .recoveryPlan(recoveryPlan)
            .createdAt(now)
            .updatedAt(now)
            .createdBy(actorId)
            .build();

        return caseRepository.save(mCase);
    }

    public Page<MentalHealthCase> listCases(String organizationId, MentalHealthCase.CaseStatus status, Pageable pageable) {
        if (status != null) {
            return caseRepository.findByOrganizationIdAndStatus(organizationId, status, pageable);
        }
        return caseRepository.findByOrganizationId(organizationId, pageable);
    }

    public MentalHealthCase getCase(String caseId) {
        return caseRepository.findById(caseId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Mental Health case not found: " + caseId));
    }

    public MentalHealthCase updateRecoveryPlan(String caseId, MentalHealthCase.RecoveryPlan newPlan, String actorId) {
        MentalHealthCase mCase = getCase(caseId);
        LocalDateTime now = LocalDateTime.now();
        newPlan.setLastUpdated(now);
        newPlan.setUpdatedBy(actorId);

        mCase.setRecoveryPlan(newPlan);
        mCase.setUpdatedAt(now);

        return caseRepository.save(mCase);
    }

    public MentalHealthCase updateStatus(String caseId, MentalHealthCase.CaseStatus status, MentalHealthCase.SuicideRiskLevel riskLevel, String actorId) {
        MentalHealthCase mCase = getCase(caseId);
        mCase.setStatus(status);
        if (riskLevel != null) {
            mCase.setRiskLevel(riskLevel);
        }
        mCase.setUpdatedAt(LocalDateTime.now());
        return caseRepository.save(mCase);
    }

    public MentalHealthSessionLog logSession(String caseId, MentalHealthSessionLog session, String actorId) {
        MentalHealthCase mCase = getCase(caseId);
        LocalDateTime now = LocalDateTime.now();

        session.setCaseId(caseId);
        session.setPatientId(mCase.getPatientId());
        session.setLoggedAt(now);
        session.setLoggedBy(actorId);
        if (session.getSessionDate() == null) {
            session.setSessionDate(now);
        }

        // Encrypt clinical notes using PhiCryptoService if present
        if (session.getNotes() != null && !session.getNotes().isBlank()) {
            session.setNotes(phiCryptoService.encrypt(session.getNotes()));
        }

        MentalHealthSessionLog saved = sessionLogRepository.save(session);
        // Decrypt notes in returned response object
        if (saved.getNotes() != null) {
            saved.setNotes(phiCryptoService.decrypt(saved.getNotes()));
        }
        return saved;
    }

    public Page<MentalHealthSessionLog> listSessions(String caseId, Pageable pageable) {
        Page<MentalHealthSessionLog> page = sessionLogRepository.findByCaseIdOrderByLoggedAtDesc(caseId, pageable);
        page.getContent().forEach(s -> {
            if (s.getNotes() != null) {
                s.setNotes(phiCryptoService.decrypt(s.getNotes()));
            }
        });
        return page;
    }
}
