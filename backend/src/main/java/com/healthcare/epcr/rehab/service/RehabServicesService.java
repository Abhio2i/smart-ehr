package com.healthcare.epcr.rehab.service;

import com.healthcare.epcr.phi.crypto.PhiCryptoService;
import com.healthcare.epcr.rehab.dto.*;
import com.healthcare.epcr.rehab.entity.*;
import com.healthcare.epcr.rehab.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class RehabServicesService {

    @Autowired
    private RehabTreatmentPlanRepository planRepository;

    @Autowired
    private RehabSessionRepository sessionRepository;

    @Autowired
    private RehabFimAssessmentRepository fimAssessmentRepository;

    @Autowired
    private RehabDevelopmentAssessmentRepository developmentAssessmentRepository;

    @Autowired
    private PhiCryptoService phiCryptoService;

    // ── Treatment Plans ───────────────────────────────────────────────────────
    public RehabTreatmentPlan createPlan(CreateRehabTreatmentPlanRequest request, String orgId, String user) {
        RehabTreatmentPlan plan = new RehabTreatmentPlan();
        plan.setPlanNumber("REH-" + (System.currentTimeMillis() % 1000000));
        plan.setOrganizationId(orgId != null ? orgId : "org123");
        plan.setPatientId(request.getPatientId());
        plan.setPatientName(request.getPatientName());
        plan.setFacilityId(request.getFacilityId() != null ? request.getFacilityId() : "St. Stanton Rehab Clinic");
        plan.setDiscipline(request.getDiscipline() != null ? request.getDiscipline().toUpperCase() : "PT");
        plan.setStatus("ACTIVE");
        plan.setGoals(request.getGoals());
        plan.setAssignedProviderId(request.getAssignedProviderId() != null ? request.getAssignedProviderId() : user);
        plan.setStartDate(request.getStartDate() != null ? request.getStartDate() : Instant.now().toString());
        plan.setTargetDischargeDate(request.getTargetDischargeDate());
        plan.setCreatedBy(user);
        plan.setUpdatedBy(user);

        return planRepository.save(plan);
    }

    public Page<RehabTreatmentPlan> getPlans(String patientId, String discipline, String status, Pageable pageable) {
        if (discipline != null && status != null && !discipline.equalsIgnoreCase("ALL") && !status.equalsIgnoreCase("ALL")) {
            return planRepository.findByDisciplineAndStatus(discipline, status, pageable);
        } else if (discipline != null && !discipline.equalsIgnoreCase("ALL")) {
            return planRepository.findByDiscipline(discipline, pageable);
        } else if (status != null && !status.equalsIgnoreCase("ALL")) {
            return planRepository.findByStatus(status, pageable);
        }
        return planRepository.findAll(pageable);
    }

    public Optional<RehabTreatmentPlan> getPlanById(String id) {
        return planRepository.findById(id);
    }

    public RehabTreatmentPlan updateStatus(String id, String status, String user) {
        RehabTreatmentPlan plan = planRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Rehab Treatment Plan not found: " + id));
        plan.setStatus(status);
        if ("COMPLETED".equalsIgnoreCase(status) || "DISCONTINUED".equalsIgnoreCase(status)) {
            plan.setActualDischargeDate(Instant.now().toString());
        }
        plan.setUpdatedBy(user);
        plan.setUpdatedAt(Instant.now());
        return planRepository.save(plan);
    }

    public RehabTreatmentPlan updateGoals(String id, List<String> goals, String user) {
        RehabTreatmentPlan plan = planRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Rehab Treatment Plan not found: " + id));
        plan.setGoals(goals);
        plan.setUpdatedBy(user);
        plan.setUpdatedAt(Instant.now());
        return planRepository.save(plan);
    }

    // ── Session Logging ───────────────────────────────────────────────────────
    public RehabSession logSession(String planId, LogRehabSessionRequest request, String user) {
        RehabTreatmentPlan plan = planRepository.findById(planId)
                .orElseThrow(() -> new RuntimeException("Rehab Treatment Plan not found: " + planId));

        RehabSession session = new RehabSession();
        session.setTreatmentPlanId(planId);
        session.setPatientId(plan.getPatientId());
        session.setSessionDate(request.getSessionDate() != null ? request.getSessionDate() : Instant.now().toString());
        session.setDurationMinutes(request.getDurationMinutes() > 0 ? request.getDurationMinutes() : 45);
        session.setActivitiesPerformed(request.getActivitiesPerformed());
        session.setFacilitatedBy(user);

        if (request.getProgressNotes() != null && !request.getProgressNotes().isBlank()) {
            session.setEncryptedProgressNotes(phiCryptoService.encrypt(request.getProgressNotes()));
        }

        return sessionRepository.save(session);
    }

    public Page<RehabSession> getSessionsForPlan(String planId, Pageable pageable) {
        Page<RehabSession> page = sessionRepository.findByTreatmentPlanIdOrderBySessionDateDesc(planId, pageable);
        page.getContent().forEach(this::decryptSessionNotes);
        return page;
    }

    private void decryptSessionNotes(RehabSession session) {
        if (session.getEncryptedProgressNotes() != null) {
            session.setEncryptedProgressNotes(phiCryptoService.decrypt(session.getEncryptedProgressNotes()));
        }
    }

    // ── FIM Assessment Scoring ────────────────────────────────────────────────
    public RehabFimAssessment recordFimAssessment(String planId, RecordFimAssessmentRequest request, String user) {
        RehabTreatmentPlan plan = planRepository.findById(planId)
                .orElseThrow(() -> new RuntimeException("Rehab Treatment Plan not found: " + planId));

        RehabFimAssessment fim = new RehabFimAssessment();
        fim.setTreatmentPlanId(planId);
        fim.setPatientId(plan.getPatientId());
        fim.setAssessedBy(user);
        fim.setAssessedAt(Instant.now());
        fim.setItems(request.getItems());

        // Compute FIM total score server-side (18 standard items, each 1 to 7)
        int total = 0;
        if (request.getItems() != null) {
            for (Integer score : request.getItems().values()) {
                if (score != null) {
                    total += Math.min(7, Math.max(1, score));
                }
            }
        }
        fim.setTotalScore(total);

        return fimAssessmentRepository.save(fim);
    }

    public List<RehabFimAssessment> getFimAssessmentsForPlan(String planId) {
        return fimAssessmentRepository.findByTreatmentPlanIdOrderByAssessedAtDesc(planId);
    }

    // ── Child Development Assessments (ASD / FASD) ────────────────────────────
    public RehabDevelopmentAssessment recordDevelopmentAssessment(RecordDevelopmentAssessmentRequest request, String orgId, String user) {
        RehabDevelopmentAssessment dev = new RehabDevelopmentAssessment();
        dev.setOrganizationId(orgId != null ? orgId : "org123");
        dev.setPatientId(request.getPatientId());
        dev.setPatientName(request.getPatientName());
        dev.setAssessmentType(request.getAssessmentType() != null ? request.getAssessmentType() : "ASD_SCREENING");
        dev.setScreeningToolUsed(request.getScreeningToolUsed() != null ? request.getScreeningToolUsed() : "M-CHAT-R");
        dev.setResults(request.getResults());
        dev.setRecommendedFollowUp(request.getRecommendedFollowUp());
        dev.setAssessedBy(user);
        dev.setAssessedAt(Instant.now());

        return developmentAssessmentRepository.save(dev);
    }

    public Page<RehabDevelopmentAssessment> getDevelopmentAssessments(String type, Pageable pageable) {
        if (type != null && !type.equalsIgnoreCase("ALL")) {
            return developmentAssessmentRepository.findByAssessmentType(type, pageable);
        }
        return developmentAssessmentRepository.findAll(pageable);
    }
}
