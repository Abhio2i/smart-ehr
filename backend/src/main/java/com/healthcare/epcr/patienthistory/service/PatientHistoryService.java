package com.healthcare.epcr.patienthistory.service;

import com.healthcare.epcr.common.exception.ResourceNotFoundException;
import com.healthcare.epcr.epcr.model.PatientCareRecord;
import com.healthcare.epcr.epcr.model.VitalSigns;
import com.healthcare.epcr.epcr.repository.PatientCareRecordRepository;
import com.healthcare.epcr.patient.model.Patient;
import com.healthcare.epcr.patient.repository.PatientRepository;
import com.healthcare.epcr.patient.security.PatientPrincipal;
import com.healthcare.epcr.patienthistory.dto.PatientHistorySummaryDTO;
import com.healthcare.epcr.patienthistory.dto.PatientTimelineEventDTO;
import com.healthcare.epcr.patienthistory.enums.ConditionStatus;
import com.healthcare.epcr.patienthistory.enums.MedicationStatus;
import com.healthcare.epcr.patienthistory.enums.TimelineEventType;
import com.healthcare.epcr.patienthistory.model.PatientAdmission;
import com.healthcare.epcr.patienthistory.model.PatientCondition;
import com.healthcare.epcr.patienthistory.model.PatientDocument;
import com.healthcare.epcr.patienthistory.model.PatientEncounter;
import com.healthcare.epcr.patienthistory.model.PatientLabResult;
import com.healthcare.epcr.patienthistory.model.PatientMedication;
import com.healthcare.epcr.patienthistory.model.PatientVital;
import com.healthcare.epcr.patienthistory.repository.PatientAdmissionRepository;
import com.healthcare.epcr.patienthistory.repository.PatientConditionRepository;
import com.healthcare.epcr.patienthistory.repository.PatientDocumentRepository;
import com.healthcare.epcr.patienthistory.repository.PatientEncounterRepository;
import com.healthcare.epcr.patienthistory.repository.PatientLabResultRepository;
import com.healthcare.epcr.patienthistory.repository.PatientMedicationRepository;
import com.healthcare.epcr.patienthistory.repository.PatientVitalRepository;
import com.healthcare.epcr.patienthistory.repository.MedicationOrderRepository;
import com.healthcare.epcr.patienthistory.model.MedicationOrder;
import com.healthcare.epcr.patienthistory.model.PatientClinicalOrder;
import com.healthcare.epcr.patienthistory.repository.PatientClinicalOrderRepository;
import com.healthcare.epcr.phi.crypto.PhiCryptoService;
import com.healthcare.epcr.security.AccessControlService;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import com.healthcare.epcr.config.SupabaseStorageService;
import com.healthcare.epcr.followup.service.FollowUpTaskService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.HashSet;
import java.util.UUID;
import java.util.stream.Collectors;

import com.healthcare.epcr.auditlog.service.AuditLogService;
import com.healthcare.epcr.user.model.User;

@Service
@RequiredArgsConstructor
@Slf4j
public class PatientHistoryService {
    private final PatientRepository patientRepository;
    private final PatientCareRecordRepository epcrRepository;
    private final AccessControlService accessControlService;
    private final PatientConditionRepository conditionRepository;
    private final PatientMedicationRepository medicationRepository;
    private final PatientEncounterRepository encounterRepository;
    private final PatientAdmissionRepository admissionRepository;
    private final PatientLabResultRepository labResultRepository;
    private final PatientVitalRepository vitalRepository;
    private final PatientDocumentRepository documentRepository;
    private final PhiCryptoService phiCryptoService;
    private final SupabaseStorageService supabaseStorageService;
    private final PatientHistoryCacheService patientHistoryCacheService;
    private final FollowUpTaskService followUpTaskService;
    private final MedicationOrderRepository medicationOrderRepository;
    private final PatientClinicalOrderRepository clinicalOrderRepository;
    private final AuditLogService auditLogService;

    @Value("${server.port:9091}")
    private int serverPort;

    public PatientHistorySummaryDTO getSummary(String patientId) {
        assertPatientAccess(patientId);
        logChartAccess(patientId, "READ_PATIENT_HISTORY", "Accessed patient medical history summary");
        Optional<PatientHistorySummaryDTO> cached = patientHistoryCacheService.getPatientHistory(patientId);
        if (cached.isPresent()) {
            return cached.get();
        }
        PatientHistorySummaryDTO summary = loadSummary(patientId);
        patientHistoryCacheService.putPatientHistory(patientId, summary);
        return summary;
    }

    private static final java.util.Map<String, Long> RECENT_READ_AUDITS = new java.util.concurrent.ConcurrentHashMap<>();

    private String resolveClientIp() {
        try {
            ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attrs != null) {
                HttpServletRequest request = attrs.getRequest();
                String xForwardedFor = request.getHeader("X-Forwarded-For");
                if (xForwardedFor != null && !xForwardedFor.isBlank()) {
                    return xForwardedFor.split(",")[0].trim();
                }
                return request.getRemoteAddr();
            }
        } catch (Exception ignored) {}
        return "127.0.0.1";
    }

    private void logChartAccess(String patientId, String action, String details) {
        try {
            User current = accessControlService.currentUser();
            String uid = current != null ? current.getId() : "SYSTEM";
            
            // Deduplication Key: userId:patientId:action
            String dedupeKey = uid + ":" + patientId + ":" + action;            long now = System.currentTimeMillis();
            Long lastLogged = RECENT_READ_AUDITS.get(dedupeKey);

            // Deduplicate read audit logs within a 60-second window
            if (lastLogged != null && (now - lastLogged) < 60_000) {
                return;
            }

            RECENT_READ_AUDITS.put(dedupeKey, now);
            auditLogService.logActionWithStatus(uid, action, "PATIENT_HISTORY", patientId, details, "SUCCESS", resolveClientIp());

            // Evict expired entries if map grows large
            if (RECENT_READ_AUDITS.size() > 1000) {
                RECENT_READ_AUDITS.entrySet().removeIf(entry -> (now - entry.getValue()) > 60_000);
            }
        } catch (Exception e) {
            log.warn("Unable to log read audit for patient {}: {}", patientId, e.getMessage());
        }
    }

    public PatientHistorySummaryDTO getRecordSummary(String patientId, String epcrRecordId) {
        assertPatientAccess(patientId);
        if (epcrRecordId == null || epcrRecordId.isBlank()) {
            throw new IllegalArgumentException("epcrRecordId is required");
        }
        PatientCareRecord record = epcrRepository.findByIdAndPatientId(epcrRecordId, patientId)
                .orElseThrow(() -> new ResourceNotFoundException("ePCR record not found for patient"));

        List<PatientEncounter> encounters = encounterRepository.findByPatientIdAndEpcrRecordId(patientId, epcrRecordId)
                .map(this::decryptEncounter)
                .map(List::of)
                .orElseGet(List::of);
        Set<String> encounterIds = encounters.stream()
                .map(PatientEncounter::getId)
                .filter(id -> id != null && !id.isBlank())
                .collect(Collectors.toSet());

        List<PatientCondition> conditions = decryptConditions(conditionRepository.findByLinkedEpcrId(epcrRecordId));
        Set<String> conditionIds = conditions.stream()
                .map(PatientCondition::getId)
                .filter(id -> id != null && !id.isBlank())
                .collect(Collectors.toSet());
        encounters.stream()
                .map(PatientEncounter::getActiveConditionIds)
                .filter(ids -> ids != null)
                .flatMap(List::stream)
                .filter(id -> id != null && !id.isBlank())
                .forEach(conditionIds::add);

        List<PatientMedication> medications = new ArrayList<>(decryptMedications(medicationRepository.findByLinkedEpcrId(epcrRecordId)));
        
        // Dynamic fetch of active CPOE orders to merge into patient summary
        List<MedicationOrder> activeCpoe = medicationOrderRepository.findByPatientIdAndOrderStatus(patientId, "ACTIVE");
        if (activeCpoe != null && !activeCpoe.isEmpty()) {
            for (MedicationOrder order : activeCpoe) {
                PatientMedication med = new PatientMedication();
                med.setId("cpoe-" + order.getId());
                med.setPatientId(patientId);
                med.setName(order.getDrugGenericName() + (order.getDrugBrandName() != null && !order.getDrugBrandName().isEmpty() ? " (" + order.getDrugBrandName() + ")" : ""));
                med.setDosage(order.getDosageStrength());
                med.setFrequency(order.getRoute() + " " + order.getFrequency());
                med.setStatus(MedicationStatus.ACTIVE);
                med.setStartDate(order.getStartDate());
                med.setEndDate(order.getEndDate());
                med.setNotes("Prescribed by Dr. " + order.getPrescribingDoctorName() + ". Clinical Indication: " + (order.getClinicalIndication() != null ? order.getClinicalIndication() : "N/A"));
                medications.add(med);
            }
        }
        List<PatientAdmission> admissions = decryptAdmissions(admissionRepository.findByPatientId(patientId).stream()
                .filter(admission -> conditionIds.contains(admission.getConditionId()))
                .collect(Collectors.toList()));
        List<PatientLabResult> labResults = decryptLabResults(labResultRepository.findByPatientId(patientId).stream()
                .filter(lab -> conditionIds.contains(lab.getConditionId()))
                .collect(Collectors.toList()));
        List<PatientVital> vitals = decryptVitals(vitalRepository.findByLinkedEpcrId(epcrRecordId));
        List<PatientDocument> documents = decryptDocuments(documentRepository.findByPatientId(patientId).stream()
                .filter(document -> conditionIds.contains(document.getConditionId())
                        || encounterIds.contains(document.getEncounterId()))
                .collect(Collectors.toList()));
        List<PatientClinicalOrder> clinicalOrders = decryptClinicalOrders(clinicalOrderRepository.findByLinkedEpcrId(epcrRecordId));
        List<PatientTimelineEventDTO> timeline = buildTimeline(patientId, conditions, medications, encounters,
                admissions, labResults, vitals, documents, clinicalOrders, List.of(record));
        String photoUrl = record.getPatientPhotoUrl();

        return new PatientHistorySummaryDTO(patientId, photoUrl, conditions, medications, encounters, admissions, labResults,
                vitals, documents, clinicalOrders, timeline);
    }

    private PatientHistorySummaryDTO loadSummary(String patientId) {
        List<PatientCondition> conditions = decryptConditions(conditionRepository.findByPatientId(patientId));
        List<PatientMedication> medications = new ArrayList<>(decryptMedications(medicationRepository.findByPatientId(patientId)));
        
        // Dynamic fetch of active CPOE orders to merge into patient summary
        List<MedicationOrder> activeCpoe = medicationOrderRepository.findByPatientIdAndOrderStatus(patientId, "ACTIVE");
        if (activeCpoe != null && !activeCpoe.isEmpty()) {
            for (MedicationOrder order : activeCpoe) {
                PatientMedication med = new PatientMedication();
                med.setId("cpoe-" + order.getId());
                med.setPatientId(patientId);
                med.setName(order.getDrugGenericName() + (order.getDrugBrandName() != null && !order.getDrugBrandName().isEmpty() ? " (" + order.getDrugBrandName() + ")" : ""));
                med.setDosage(order.getDosageStrength());
                med.setFrequency(order.getRoute() + " " + order.getFrequency());
                med.setStatus(MedicationStatus.ACTIVE);
                med.setStartDate(order.getStartDate());
                med.setEndDate(order.getEndDate());
                med.setNotes("Prescribed by Dr. " + order.getPrescribingDoctorName() + ". Clinical Indication: " + (order.getClinicalIndication() != null ? order.getClinicalIndication() : "N/A"));
                medications.add(med);
            }
        }
        List<PatientEncounter> encounters = decryptEncounters(encounterRepository.findByPatientId(patientId));
        List<PatientAdmission> admissions = decryptAdmissions(admissionRepository.findByPatientId(patientId));
        List<PatientLabResult> labResults = decryptLabResults(labResultRepository.findByPatientId(patientId));
        List<PatientVital> vitals = decryptVitals(vitalRepository.findByPatientIdOrderByRecordedAtDesc(patientId));
        List<PatientDocument> documents = decryptDocuments(documentRepository.findByPatientId(patientId));
        List<PatientClinicalOrder> clinicalOrders = decryptClinicalOrders(clinicalOrderRepository.findByPatientId(patientId));
        List<com.healthcare.epcr.epcr.model.PatientCareRecord> epcrRecords = epcrRepository.findByPatientId(patientId);
        List<PatientTimelineEventDTO> timeline = buildTimeline(patientId, conditions, medications, encounters,
                admissions, labResults, vitals, documents, clinicalOrders, epcrRecords);
        String photoUrl = epcrRecords.stream()
                .map(com.healthcare.epcr.epcr.model.PatientCareRecord::getPatientPhotoUrl)
                .filter(url -> url != null && !url.isBlank())
                .findFirst()
                .orElse(null);

        return new PatientHistorySummaryDTO(patientId, photoUrl, conditions, medications, encounters, admissions, labResults,
                vitals, documents, clinicalOrders, timeline);
    }

    public List<PatientTimelineEventDTO> getTimeline(String patientId) {
        return getSummary(patientId).getTimeline();
    }

    public List<PatientCondition> getConditions(String patientId) {
        return getSummary(patientId).getConditions();
    }

    public PatientCondition createCondition(String patientId, PatientCondition request) {
        assertManageAccess(patientId);
        LocalDateTime now = LocalDateTime.now();
        request.setId(null);
        request.setPatientId(patientId);
        if (request.getStatus() == null) {
            request.setStatus(ConditionStatus.ACTIVE);
        }
        request.setCreatedAt(now);
        request.setUpdatedAt(now);
        encryptCondition(request);
        PatientCondition saved = decryptCondition(conditionRepository.save(request));
        evictPatientHistory(patientId);
        return saved;
    }

    public PatientCondition updateCondition(String patientId, String id, PatientCondition request) {
        assertManageAccess(patientId);
        PatientCondition existing = findPatientOwnedCondition(patientId, id);
        if (request.getName() != null) existing.setName(request.getName());
        if (request.getStatus() != null) existing.setStatus(request.getStatus());
        if (request.getSeverity() != null) existing.setSeverity(request.getSeverity());
        if (request.getDateDiagnosed() != null) existing.setDateDiagnosed(request.getDateDiagnosed());
        if (request.getDateResolved() != null) existing.setDateResolved(request.getDateResolved());
        if (request.getNotes() != null) existing.setNotes(request.getNotes());
        if (request.getFindings() != null) existing.setFindings(request.getFindings());
        if (request.getSymptoms() != null) existing.setSymptoms(request.getSymptoms());
        if (request.getAnalysis() != null) existing.setAnalysis(request.getAnalysis());
        if (request.getRecommendedTreatment() != null) existing.setRecommendedTreatment(request.getRecommendedTreatment());
        existing.setUpdatedAt(LocalDateTime.now());
        encryptCondition(existing);
        PatientCondition saved = decryptCondition(conditionRepository.save(existing));
        evictPatientHistory(patientId);
        return saved;
    }

    public void deleteCondition(String patientId, String id) {
        assertManageAccess(patientId);
        findPatientOwnedCondition(patientId, id);
        conditionRepository.deleteById(id);
        evictPatientHistory(patientId);
    }


    public List<PatientMedication> getMedications(String patientId) {
        return getSummary(patientId).getMedications();
    }

    public PatientMedication createMedication(String patientId, PatientMedication request) {
        assertManageAccess(patientId);
        validateConditionLink(patientId, request.getConditionId());
        LocalDateTime now = LocalDateTime.now();
        request.setId(null);
        request.setPatientId(patientId);
        if (request.getStatus() == null) {
            request.setStatus(MedicationStatus.ACTIVE);
        }
        request.setCreatedAt(now);
        request.setUpdatedAt(now);
        encryptMedication(request);
        PatientMedication saved = decryptMedication(medicationRepository.save(request));
        evictPatientHistory(patientId);
        return saved;
    }

    public PatientMedication updateMedication(String patientId, String id, PatientMedication request) {
        assertManageAccess(patientId);
        PatientMedication existing = findPatientOwnedMedication(patientId, id);
        if (request.getConditionId() != null) {
            validateConditionLink(patientId, request.getConditionId());
            existing.setConditionId(request.getConditionId());
        }
        if (request.getName() != null) existing.setName(request.getName());
        if (request.getDosage() != null) existing.setDosage(request.getDosage());
        if (request.getFrequency() != null) existing.setFrequency(request.getFrequency());
        if (request.getStatus() != null) existing.setStatus(request.getStatus());
        if (request.getStartDate() != null) existing.setStartDate(request.getStartDate());
        if (request.getEndDate() != null) existing.setEndDate(request.getEndDate());
        if (request.getNotes() != null) existing.setNotes(request.getNotes());
        existing.setUpdatedAt(LocalDateTime.now());
        encryptMedication(existing);
        PatientMedication saved = decryptMedication(medicationRepository.save(existing));
        evictPatientHistory(patientId);
        return saved;
    }

    public void deleteMedication(String patientId, String id) {
        assertManageAccess(patientId);
        findPatientOwnedMedication(patientId, id);
        medicationRepository.deleteById(id);
        evictPatientHistory(patientId);
    }

    public List<PatientEncounter> getEncounters(String patientId) {
        return getSummary(patientId).getEncounters();
    }

    public PatientEncounter createEncounter(String patientId, PatientEncounter request) {
        assertManageAccess(patientId);
        validateConditionLink(patientId, request.getConditionId());
        PatientEncounter existing = findExistingEpcrEncounter(patientId, request.getEpcrRecordId()).orElse(null);
        if (request.getEpcrRecordId() != null && !request.getEpcrRecordId().isBlank()) {
            PatientCareRecord record = epcrRepository.findByIdAndPatientId(request.getEpcrRecordId(), patientId)
                    .orElseThrow(() -> new ResourceNotFoundException("ePCR record not found for patient"));
            if (request.getDate() == null && record.getIncidentDateTime() != null) {
                request.setDate(record.getIncidentDateTime().toLocalDate());
            }
            if (request.getChiefComplaint() == null) {
                String primaryImpression = phiCryptoService.decrypt(record.getPrimaryImpression());
                String incidentDescription = phiCryptoService.decrypt(record.getIncidentDescription());
                request.setChiefComplaint(primaryImpression != null
                        ? primaryImpression
                        : incidentDescription);
            }
        }
        if (existing != null) {
            PatientEncounter saved = updateExistingEncounter(existing, request);
            evictPatientHistory(patientId);
            return saved;
        }
        LocalDateTime now = LocalDateTime.now();
        request.setId(null);
        request.setPatientId(patientId);
        request.setCreatedAt(now);
        request.setUpdatedAt(now);
        encryptEncounter(request);
        PatientEncounter saved = decryptEncounter(encounterRepository.save(request));
        evictPatientHistory(patientId);
        return saved;
    }

    private Optional<PatientEncounter> findExistingEpcrEncounter(String patientId, String epcrRecordId) {
        if (patientId == null || patientId.isBlank() || epcrRecordId == null || epcrRecordId.isBlank()) {
            return Optional.empty();
        }
        return encounterRepository.findByPatientIdAndEpcrRecordId(patientId, epcrRecordId);
    }

    private PatientEncounter updateExistingEncounter(PatientEncounter existing, PatientEncounter request) {
        PatientEncounter merged = decryptEncounter(existing);
        if (request.getConditionId() != null) merged.setConditionId(request.getConditionId());
        if (request.getDate() != null) merged.setDate(request.getDate());
        if (request.getChiefComplaint() != null) merged.setChiefComplaint(request.getChiefComplaint());
        if (request.getOutcome() != null) merged.setOutcome(request.getOutcome());
        if (request.getActiveConditionIds() != null) merged.setActiveConditionIds(request.getActiveConditionIds());
        if (request.getNotes() != null) merged.setNotes(request.getNotes());
        merged.setUpdatedAt(LocalDateTime.now());
        encryptEncounter(merged);
        return decryptEncounter(encounterRepository.save(merged));
    }

    public PatientEncounter updateEncounter(String patientId, String id, PatientEncounter request) {
        assertManageAccess(patientId);
        PatientEncounter existing = findPatientOwnedEncounter(patientId, id);
        if (request.getConditionId() != null) {
            validateConditionLink(patientId, request.getConditionId());
            existing.setConditionId(request.getConditionId());
        }
        if (request.getEpcrRecordId() != null) existing.setEpcrRecordId(request.getEpcrRecordId());
        if (request.getDate() != null) existing.setDate(request.getDate());
        if (request.getChiefComplaint() != null) existing.setChiefComplaint(request.getChiefComplaint());
        if (request.getOutcome() != null) existing.setOutcome(request.getOutcome());
        if (request.getActiveConditionIds() != null) existing.setActiveConditionIds(request.getActiveConditionIds());
        if (request.getNotes() != null) existing.setNotes(request.getNotes());
        existing.setUpdatedAt(LocalDateTime.now());
        encryptEncounter(existing);
        PatientEncounter saved = decryptEncounter(encounterRepository.save(existing));
        evictPatientHistory(patientId);
        return saved;
    }

    public void deleteEncounter(String patientId, String id) {
        assertManageAccess(patientId);
        findPatientOwnedEncounter(patientId, id);
        encounterRepository.deleteById(id);
        evictPatientHistory(patientId);
    }

    public List<PatientAdmission> getAdmissions(String patientId) {
        return getSummary(patientId).getAdmissions();
    }

    public PatientAdmission createAdmission(String patientId, PatientAdmission request) {
        assertManageAccess(patientId);
        validateConditionLink(patientId, request.getConditionId());
        LocalDateTime now = LocalDateTime.now();
        request.setId(null);
        request.setPatientId(patientId);
        request.setCreatedAt(now);
        request.setUpdatedAt(now);
        encryptAdmission(request);
        PatientAdmission saved = decryptAdmission(admissionRepository.save(request));
        evictPatientHistory(patientId);
        return saved;
    }

    public PatientAdmission updateAdmission(String patientId, String id, PatientAdmission request) {
        assertManageAccess(patientId);
        PatientAdmission existing = findPatientOwnedAdmission(patientId, id);
        if (request.getConditionId() != null) {
            validateConditionLink(patientId, request.getConditionId());
            existing.setConditionId(request.getConditionId());
        }
        if (request.getHospital() != null) existing.setHospital(request.getHospital());
        if (request.getAdmitDate() != null) existing.setAdmitDate(request.getAdmitDate());
        if (request.getDischargeDate() != null) existing.setDischargeDate(request.getDischargeDate());
        if (request.getReason() != null) existing.setReason(request.getReason());
        if (request.getOutcome() != null) existing.setOutcome(request.getOutcome());
        if (request.getNotes() != null) existing.setNotes(request.getNotes());
        existing.setUpdatedAt(LocalDateTime.now());
        encryptAdmission(existing);
        PatientAdmission saved = decryptAdmission(admissionRepository.save(existing));
        evictPatientHistory(patientId);
        return saved;
    }

    public void deleteAdmission(String patientId, String id) {
        assertManageAccess(patientId);
        findPatientOwnedAdmission(patientId, id);
        admissionRepository.deleteById(id);
        evictPatientHistory(patientId);
    }

    public List<PatientLabResult> getLabResults(String patientId) {
        return getSummary(patientId).getLabResults();
    }

    public PatientLabResult createLabResult(String patientId, PatientLabResult request) {
        assertManageAccess(patientId);
        validateConditionLink(patientId, request.getConditionId());
        LocalDateTime now = LocalDateTime.now();
        request.setId(null);
        request.setPatientId(patientId);
        request.setCreatedAt(now);
        request.setUpdatedAt(now);
        encryptLabResult(request);
        PatientLabResult saved = decryptLabResult(labResultRepository.save(request));
        evictPatientHistory(patientId);
        return saved;
    }

    public PatientLabResult updateLabResult(String patientId, String id, PatientLabResult request) {
        assertManageAccess(patientId);
        PatientLabResult existing = findPatientOwnedLabResult(patientId, id);
        if (request.getConditionId() != null) {
            validateConditionLink(patientId, request.getConditionId());
            existing.setConditionId(request.getConditionId());
        }
        if (request.getTestName() != null) existing.setTestName(request.getTestName());
        if (request.getValue() != null) existing.setValue(request.getValue());
        if (request.getUnit() != null) existing.setUnit(request.getUnit());
        if (request.getNormalRange() != null) existing.setNormalRange(request.getNormalRange());
        if (request.getDate() != null) existing.setDate(request.getDate());
        if (request.getInterpretation() != null) existing.setInterpretation(request.getInterpretation());
        if (request.getNotes() != null) existing.setNotes(request.getNotes());
        existing.setUpdatedAt(LocalDateTime.now());
        encryptLabResult(existing);
        PatientLabResult saved = decryptLabResult(labResultRepository.save(existing));
        evictPatientHistory(patientId);
        return saved;
    }

    public void deleteLabResult(String patientId, String id) {
        assertManageAccess(patientId);
        findPatientOwnedLabResult(patientId, id);
        labResultRepository.deleteById(id);
        evictPatientHistory(patientId);
    }

    public List<PatientVital> getVitals(String patientId, LocalDateTime start, LocalDateTime end) {
        if (start != null && end != null) {
            return getSummary(patientId).getVitals().stream()
                    .filter(vital -> vital.getRecordedAt() != null)
                    .filter(vital -> !vital.getRecordedAt().isBefore(start) && !vital.getRecordedAt().isAfter(end))
                    .collect(Collectors.toList());
        }
        return getSummary(patientId).getVitals();
    }

    public void syncVitalsFromEpcr(PatientCareRecord record) {
        if (record == null || record.getId() == null || record.getId().isBlank()
                || record.getPatientId() == null || record.getPatientId().isBlank()) {
            return;
        }

        List<PatientVital> existingVitals = vitalRepository.findByLinkedEpcrId(record.getId());
        if (existingVitals != null && !existingVitals.isEmpty()) {
            vitalRepository.deleteAll(existingVitals);
        }

        List<PatientVital> vitals = epcrVitals(record);
        if (!vitals.isEmpty()) {
            LocalDateTime now = LocalDateTime.now();
            vitals.forEach(vital -> {
                vital.setId(null);
                vital.setPatientId(record.getPatientId());
                vital.setOrganizationId(record.getOrganizationId());
                vital.setLinkedEpcrId(record.getId());
                if (vital.getRecordedAt() == null) {
                    vital.setRecordedAt(record.getIncidentDateTime() == null ? now : record.getIncidentDateTime());
                }
                if (vital.getRecordedBy() == null || vital.getRecordedBy().isBlank()) {
                    vital.setRecordedBy(record.getParamedicsId());
                }
                if (vital.getNotes() == null || vital.getNotes().isBlank()) {
                    vital.setNotes("Auto-linked from ePCR " + value(record.getIncidentNumber()));
                }
                vital.setCreatedAt(now);
                vital.setUpdatedAt(now);
                encryptVital(vital);
            });
            vitalRepository.saveAll(vitals);
        }
        evictPatientHistory(record.getPatientId());
    }

    public void syncConditionsAndMedicationsFromEpcr(PatientCareRecord record) {
        if (record == null || record.getId() == null || record.getId().isBlank()
                || record.getPatientId() == null || record.getPatientId().isBlank()) {
            return;
        }

        List<PatientMedication> existingMedications = medicationRepository.findByLinkedEpcrId(record.getId());
        if (existingMedications != null && !existingMedications.isEmpty()) {
            medicationRepository.deleteAll(existingMedications);
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDate eventDate = record.getIncidentDateTime() == null ? now.toLocalDate() : record.getIncidentDateTime().toLocalDate();
        List<PatientCondition> incomingConditions = epcrConditions(record, eventDate, now);
        List<PatientCondition> existingLinkedToEpcr = conditionRepository.findByLinkedEpcrId(record.getId());

        List<PatientCondition> decryptedExistingLinked = decryptConditions(existingLinkedToEpcr);

        Map<String, PatientCondition> existingLinkedByName = decryptedExistingLinked.stream()
                .filter(condition -> normalizedKey(condition.getName()) != null)
                .collect(Collectors.toMap(
                        condition -> normalizedKey(condition.getName()),
                        condition -> condition,
                        (left, right) -> right
                ));

        Set<String> incomingKeys = incomingConditions.stream()
                .map(condition -> normalizedKey(condition.getName()))
                .filter(key -> key != null)
                .collect(Collectors.toCollection(HashSet::new));

        List<PatientCondition> toSave = new ArrayList<>();
        List<String> toDelete = new ArrayList<>();

        // Remove stale auto-linked conditions no longer present in this ePCR.
        decryptedExistingLinked.forEach(existing -> {
            String key = normalizedKey(existing.getName());
            if (key != null && !incomingKeys.contains(key) && existing.getId() != null) {
                toDelete.add(existing.getId());
            }
        });

        // Upsert incoming conditions by normalized name.
        for (PatientCondition incoming : incomingConditions) {
            String key = normalizedKey(incoming.getName());
            if (key == null) {
                continue;
            }

            PatientCondition target = existingLinkedByName.get(key);

            if (target == null) {
                // Auto-created ePCR conditions stay scoped to this specific record.
                toSave.add(incoming);
                existingLinkedByName.put(key, incoming);
                continue;
            }

            // Refresh existing condition instead of creating duplicate.
            target.setLinkedEpcrId(record.getId());
            target.setStatus(ConditionStatus.ACTIVE);
            target.setDateDiagnosed(incoming.getDateDiagnosed());
            target.setDateResolved(incoming.getDateResolved());
            target.setSeverity(firstNonBlank(incoming.getSeverity(), target.getSeverity()));
            target.setNotes(firstNonBlank(incoming.getNotes(), target.getNotes()));
            target.setFindings(firstNonBlank(incoming.getFindings(), target.getFindings()));
            target.setSymptoms(firstNonBlank(incoming.getSymptoms(), target.getSymptoms()));
            target.setAnalysis(firstNonBlank(incoming.getAnalysis(), target.getAnalysis()));
            target.setRecommendedTreatment(firstNonBlank(incoming.getRecommendedTreatment(), target.getRecommendedTreatment()));
            target.setUpdatedAt(now);
            toSave.add(target);
        }

        if (!toDelete.isEmpty()) {
            conditionRepository.deleteAllById(toDelete);
        }

        List<PatientCondition> savedConditions = toSave.isEmpty()
                ? List.of()
                : decryptConditions(conditionRepository.saveAll(encryptConditions(toSave)));

        List<PatientMedication> medications = epcrMedications(record, eventDate, now);
        if (!medications.isEmpty()) {
            String defaultConditionId = savedConditions.isEmpty() ? null : savedConditions.get(0).getId();
            medications.forEach(medication -> medication.setConditionId(defaultConditionId));
            medicationRepository.saveAll(encryptMedications(medications));
        }
        evictPatientHistory(record.getPatientId());
    }

    private List<PatientCondition> epcrConditions(PatientCareRecord record, LocalDate eventDate, LocalDateTime now) {
        List<String> names = new ArrayList<>();
        addValue(names, record.getPrimaryImpression());
        addValue(names, record.getSecondaryImpression());
        addValue(names, record.getDiagnosis());
        addValue(names, record.getComorbidity());
        if (record.getMedicalHistory() != null) {
            addValues(names, record.getMedicalHistory().getPastConditions());
        }

        List<String> compacted = compactConditionNames(names);
        if (compacted.isEmpty()) {
            return List.of();
        }

        Set<String> complaintsSet = new HashSet<>();
        if (record.getComplaints() != null) {
            record.getComplaints().stream()
                .filter(c -> c != null)
                .map(this::normalizedComparison)
                .filter(c -> c != null)
                .forEach(complaintsSet::add);
        }
        if (record.getStructuredComplaints() != null) {
            record.getStructuredComplaints().stream()
                .filter(c -> c != null && c.getComplaint() != null)
                .map(c -> normalizedComparison(c.getComplaint()))
                .filter(c -> c != null)
                .forEach(complaintsSet::add);
        }

        // Keep one primary condition per ePCR to avoid UI-level duplicate condition cards.
        String primaryConditionName = selectPrimaryConditionName(record, compacted);
        return List.of(primaryConditionName).stream()
                .map(name -> {
                    PatientCondition condition = new PatientCondition();
                    condition.setPatientId(record.getPatientId());
                    condition.setLinkedEpcrId(record.getId());
                    condition.setName(name);
                    condition.setStatus(ConditionStatus.ACTIVE);
                    condition.setDateDiagnosed(eventDate);
                    condition.setNotes("Auto-linked from ePCR " + value(record.getIncidentNumber()));
                    condition.setFindings(buildEpcrFindings(record, complaintsSet));
                    condition.setSymptoms(buildEpcrSymptoms(record));
                    
                    String analysisCandidate = null;
                    String txProvided = record.getTreatmentProvided();
                    if (txProvided != null && !txProvided.isBlank()) {
                        String normTx = normalizedComparison(txProvided);
                        if (normTx != null && !complaintsSet.contains(normTx)) {
                            analysisCandidate = txProvided;
                        }
                    }
                    if (analysisCandidate == null || analysisCandidate.isBlank()) {
                        String diagnosis = record.getDiagnosis();
                        if (diagnosis != null && !diagnosis.isBlank()) {
                            String normDiag = normalizedComparison(diagnosis);
                            if (normDiag != null && !complaintsSet.contains(normDiag)) {
                                analysisCandidate = diagnosis;
                            }
                        }
                    }
                    condition.setAnalysis(analysisCandidate);
                    condition.setRecommendedTreatment(buildEpcrPlan(record, complaintsSet));
                    condition.setCreatedAt(now);
                    condition.setUpdatedAt(now);
                    return condition;
                })
                .collect(Collectors.toList());
    }

    private String buildEpcrFindings(PatientCareRecord record, Set<String> complaintsSet) {
        List<String> findings = new ArrayList<>();
        addFindingValue(findings, record.getIncidentDescription(), complaintsSet);
        addFindingValue(findings, record.getDiagnosis(), complaintsSet);
        addFindingValue(findings, record.getPrimaryImpression(), complaintsSet);
        addFindingValue(findings, record.getSecondaryImpression(), complaintsSet);
        addValues(findings, record.getVitals());
        return joinLines(findings);
    }

    private void addFindingValue(List<String> target, String value, Set<String> complaintsSet) {
        if (value != null && !value.isBlank()) {
            String norm = normalizedComparison(value);
            if (norm != null && !complaintsSet.contains(norm)) {
                target.add(value.trim());
            }
        }
    }

    private String buildEpcrSymptoms(PatientCareRecord record) {
        List<String> symptoms = new ArrayList<>();
        addValues(symptoms, record.getComplaints());
        if (record.getStructuredComplaints() != null) {
            record.getStructuredComplaints().forEach(complaint -> {
                if (complaint == null) {
                    return;
                }
                addValue(symptoms, complaint.getComplaint());
                addValue(symptoms, complaint.getAssociatedSymptoms());
            });
        }
        return joinLines(symptoms);
    }

    private String buildEpcrPlan(PatientCareRecord record, Set<String> complaintsSet) {
        String dietAdvice = record.getDietAdvice() == null ? null : joinLines(record.getDietAdvice());
        List<String> candidates = new ArrayList<>();
        addFindingValue(candidates, record.getTreatmentPlan(), complaintsSet);
        addFindingValue(candidates, dietAdvice, complaintsSet);
        addFindingValue(candidates, record.getTreatmentProvided(), complaintsSet);
        return joinLines(candidates);
    }

    private String joinLines(List<String> values) {
        if (values == null) {
            return null;
        }
        String joined = values.stream()
                .filter(value -> value != null && !value.isBlank())
                .map(String::trim)
                .distinct()
                .collect(Collectors.joining("\n"));
        return joined.isBlank() ? null : joined;
    }

    private List<PatientMedication> epcrMedications(PatientCareRecord record, LocalDate eventDate, LocalDateTime now) {
        List<PatientMedication> medications = new ArrayList<>();
        addMedication(medications, record.getCurrentMedicines(), null, eventDate, now, record);
        addMedicationValues(medications, record.getMedicalHistory() == null ? null : record.getMedicalHistory().getCurrentMedications(),
                eventDate, now, record);
        addMedicationValues(medications, record.getMedicationsAdministered(), eventDate, now, record);
        if (record.getStructuredMedications() != null) {
            record.getStructuredMedications().forEach(source -> {
                String dosage = source.getDosage() == null ? null : source.getDosage() + valueWithPrefix(" ", source.getUnit());
                LocalDate startDate = source.getAdministeredAt() == null ? eventDate : source.getAdministeredAt().toLocalDate();
                String notes = firstNonBlank(source.getNotes(), source.getPatientResponse(), source.getIndication());
                addMedication(medications, source.getMedicationName(), dosage, startDate, now, record, notes);
            });
        }
        return dedupeMedications(medications);
    }

    private void addMedicationValues(List<PatientMedication> medications, List<String> values, LocalDate startDate,
                                     LocalDateTime now, PatientCareRecord record) {
        if (values == null) {
            return;
        }
        values.forEach(value -> addMedication(medications, value, null, startDate, now, record));
    }

    private void addMedication(List<PatientMedication> medications, String name, String dosage, LocalDate startDate,
                               LocalDateTime now, PatientCareRecord record) {
        addMedication(medications, name, dosage, startDate, now, record,
                "Auto-linked from ePCR " + value(record.getIncidentNumber()));
    }

    private void addMedication(List<PatientMedication> medications, String name, String dosage, LocalDate startDate,
                               LocalDateTime now, PatientCareRecord record, String notes) {
        if (name == null || name.isBlank()) {
            return;
        }
        PatientMedication medication = new PatientMedication();
        medication.setPatientId(record.getPatientId());
        medication.setLinkedEpcrId(record.getId());
        medication.setName(name.trim());
        medication.setDosage(dosage);
        medication.setStatus(MedicationStatus.ACTIVE);
        medication.setStartDate(startDate);
        medication.setNotes(notes);
        medication.setCreatedAt(now);
        medication.setUpdatedAt(now);
        medications.add(medication);
    }

    private List<PatientCondition> encryptConditions(List<PatientCondition> conditions) {
        conditions.forEach(this::encryptCondition);
        return conditions;
    }

    private List<PatientMedication> encryptMedications(List<PatientMedication> medications) {
        medications.forEach(this::encryptMedication);
        return medications;
    }

    private void addValues(List<String> target, List<String> values) {
        if (values == null) {
            return;
        }
        values.forEach(value -> addValue(target, value));
    }

    private void addValue(List<String> target, String value) {
        if (value != null && !value.isBlank()) {
            target.add(value.trim());
        }
    }

    private List<PatientVital> epcrVitals(PatientCareRecord record) {
        if (record.getStructuredVitals() != null && !record.getStructuredVitals().isEmpty()) {
            return record.getStructuredVitals().stream()
                    .map(vital -> fromStructuredVital(record, vital))
                    .collect(Collectors.toList());
        }
        PatientVital vital = fromRecordVitals(record);
        return vital == null ? List.of() : List.of(vital);
    }

    private PatientVital fromStructuredVital(PatientCareRecord record, VitalSigns source) {
        PatientVital target = new PatientVital();
        target.setRecordedAt(source.getRecordedAt());
        target.setRecordedBy(source.getRecordedBy());
        target.setSystolicBP(source.getSystolicBP());
        target.setDiastolicBP(source.getDiastolicBP());
        target.setHeartRate(source.getHeartRate());
        target.setPulseRate(source.getPulseRate() == null ? source.getHeartRate() : source.getPulseRate());
        target.setOxygenSaturation(source.getOxygenSaturation() == null ? null : source.getOxygenSaturation().doubleValue());
        target.setRespiratoryRate(source.getRespiratoryRate());
        target.setOxygenDeliveryMethod(source.getOxygenDeliveryMethod());
        target.setGlasgowComaScale(source.getGlasgowComaScale());
        target.setGcEye(source.getGcEye());
        target.setGcVerbal(source.getGcVerbal());
        target.setGcMotor(source.getGcMotor());
        target.setAvpu(source.getAvpu());
        target.setPainScore(source.getPainScore());
        target.setPainLocation(source.getPainLocation());
        target.setTemperature(source.getTemperature());
        target.setTemperatureRoute(source.getTemperatureRoute());
        target.setBloodGlucose(source.getBloodGlucose());
        target.setHemoglobin(source.getHemoglobin());
        target.setPupilLeft(source.getPupilLeft());
        target.setPupilRight(source.getPupilRight());
        target.setPupilsEqual(source.getPupilsEqual());
        target.setPupilsReactive(source.getPupilsReactive());
        target.setSkinColor(source.getSkinColor());
        target.setSkinCondition(source.getSkinCondition());
        target.setSkinTemperature(source.getSkinTemperature());
        target.setNotes("Auto-linked from ePCR " + value(record.getIncidentNumber()));
        return target;
    }

    private PatientVital fromRecordVitals(PatientCareRecord record) {
        if (record.getSystolicBp() == null && record.getDiastolicBp() == null && record.getHeartRate() == null
                && record.getPulseRate() == null && record.getSpo2() == null && record.getRespirationRate() == null
                && record.getTemperature() == null && record.getBloodSugar() == null && record.getHemoglobin() == null) {
            return null;
        }
        PatientVital vital = new PatientVital();
        vital.setSystolicBP(record.getSystolicBp());
        vital.setDiastolicBP(record.getDiastolicBp());
        vital.setHeartRate(record.getHeartRate());
        vital.setPulseRate(record.getPulseRate());
        vital.setOxygenSaturation(record.getSpo2());
        vital.setRespiratoryRate(record.getRespirationRate());
        vital.setTemperature(record.getTemperature());
        vital.setBloodGlucose(record.getBloodSugar());
        vital.setHemoglobin(record.getHemoglobin());
        vital.setRecordedBy(record.getParamedicsId());
        vital.setNotes("Auto-linked from ePCR " + value(record.getIncidentNumber()));
        return vital;
    }

    public PatientVital getLatestVital(String patientId) {
        return getSummary(patientId).getVitals().stream()
                .filter(vital -> vital.getRecordedAt() != null)
                .max(Comparator.comparing(PatientVital::getRecordedAt))
                .orElseThrow(() -> new ResourceNotFoundException("No vitals found for patient: " + patientId));
    }

    public PatientVital createVital(String patientId, PatientVital request) {
        assertManageAccess(patientId);
        validateEpcrLink(patientId, request.getLinkedEpcrId());
        LocalDateTime now = LocalDateTime.now();
        request.setId(null);
        request.setPatientId(patientId);
        request.setOrganizationId(resolveOrganizationId(patientId));
        if (request.getRecordedBy() == null || request.getRecordedBy().isBlank()) {
            request.setRecordedBy(currentActorName());
        }
        if (request.getRecordedAt() == null) {
            request.setRecordedAt(now);
        }
        if (request.getRecordedByName() == null || request.getRecordedByName().isBlank()) {
            request.setRecordedByName(currentActorName());
        }
        request.setCreatedAt(now);
        request.setUpdatedAt(now);
        encryptVital(request);
        PatientVital saved = decryptVital(vitalRepository.save(request));
        evictPatientHistory(patientId);
        triggerFollowUpCheck(saved);
        return saved;
    }

    public PatientVital updateVital(String patientId, String id, PatientVital request) {
        assertManageAccess(patientId);
        PatientVital existing = findPatientOwnedVital(patientId, id);
        if (request.getLinkedEpcrId() != null) {
            validateEpcrLink(patientId, request.getLinkedEpcrId());
            existing.setLinkedEpcrId(request.getLinkedEpcrId());
        }
        if (request.getLinkedEncounterId() != null) existing.setLinkedEncounterId(request.getLinkedEncounterId());
        if (request.getRecordedBy() != null) existing.setRecordedBy(request.getRecordedBy());
        if (request.getRecordedByName() != null) existing.setRecordedByName(request.getRecordedByName());
        if (request.getRecordedAt() != null) existing.setRecordedAt(request.getRecordedAt());
        if (request.getSystolicBP() != null) existing.setSystolicBP(request.getSystolicBP());
        if (request.getDiastolicBP() != null) existing.setDiastolicBP(request.getDiastolicBP());
        if (request.getHeartRate() != null) existing.setHeartRate(request.getHeartRate());
        if (request.getPulseRate() != null) existing.setPulseRate(request.getPulseRate());
        if (request.getOxygenSaturation() != null) existing.setOxygenSaturation(request.getOxygenSaturation());
        if (request.getRespiratoryRate() != null) existing.setRespiratoryRate(request.getRespiratoryRate());
        if (request.getOxygenDeliveryMethod() != null) existing.setOxygenDeliveryMethod(request.getOxygenDeliveryMethod());
        if (request.getGlasgowComaScale() != null) existing.setGlasgowComaScale(request.getGlasgowComaScale());
        if (request.getGcEye() != null) existing.setGcEye(request.getGcEye());
        if (request.getGcVerbal() != null) existing.setGcVerbal(request.getGcVerbal());
        if (request.getGcMotor() != null) existing.setGcMotor(request.getGcMotor());
        if (request.getAvpu() != null) existing.setAvpu(request.getAvpu());
        if (request.getPainScore() != null) existing.setPainScore(request.getPainScore());
        if (request.getPainLocation() != null) existing.setPainLocation(request.getPainLocation());
        if (request.getTemperature() != null) existing.setTemperature(request.getTemperature());
        if (request.getTemperatureRoute() != null) existing.setTemperatureRoute(request.getTemperatureRoute());
        if (request.getBloodGlucose() != null) existing.setBloodGlucose(request.getBloodGlucose());
        if (request.getHemoglobin() != null) existing.setHemoglobin(request.getHemoglobin());
        if (request.getPupilLeft() != null) existing.setPupilLeft(request.getPupilLeft());
        if (request.getPupilRight() != null) existing.setPupilRight(request.getPupilRight());
        if (request.getPupilsEqual() != null) existing.setPupilsEqual(request.getPupilsEqual());
        if (request.getPupilsReactive() != null) existing.setPupilsReactive(request.getPupilsReactive());
        if (request.getSkinColor() != null) existing.setSkinColor(request.getSkinColor());
        if (request.getSkinCondition() != null) existing.setSkinCondition(request.getSkinCondition());
        if (request.getSkinTemperature() != null) existing.setSkinTemperature(request.getSkinTemperature());
        if (request.getNotes() != null) existing.setNotes(request.getNotes());
        existing.setUpdatedAt(LocalDateTime.now());
        encryptVital(existing);
        PatientVital saved = decryptVital(vitalRepository.save(existing));
        evictPatientHistory(patientId);
        triggerFollowUpCheck(saved);
        return saved;
    }

    private void triggerFollowUpCheck(PatientVital vital) {
        try {
            Patient patient = patientRepository.findByPatientId(vital.getPatientId()).orElse(null);
            if (patient == null) {
                return;
            }

            String patientName = epcrRepository.findByPatientId(vital.getPatientId()).stream()
                    .filter(r -> r.getPatientName() != null && !r.getPatientName().isBlank())
                    .max(Comparator.comparing(PatientCareRecord::getUpdatedAt))
                    .map(r -> phiCryptoService.decrypt(r.getPatientName()))
                    .orElse("Patient");

            String patientEmail = patient.getEmail();
            if (patientEmail != null && !patientEmail.isBlank()) {
                followUpTaskService.scheduleIfCritical(vital, patientName, patientEmail);
            }
        } catch (Exception ex) {
            log.error("Failed to trigger critical follow-up check for vital history record: {}", vital.getId(), ex);
        }
    }

    public void deleteVital(String patientId, String id) {
        assertManageAccess(patientId);
        findPatientOwnedVital(patientId, id);
        vitalRepository.deleteById(id);

        // Best-effort cleanup of any pending follow-up task linked to this vital log
        try {
            PatientVital deletedMock = new PatientVital();
            deletedMock.setId(id);
            deletedMock.setPatientId(patientId);
            followUpTaskService.scheduleIfCritical(deletedMock, null, null);
        } catch (Exception ex) {
            log.error("Failed to delete follow-up task for deleted vital: {}", id, ex);
        }

        evictPatientHistory(patientId);
    }

    public List<PatientDocument> getDocuments(String patientId) {
        return getSummary(patientId).getDocuments();
    }

    public PatientDocument createDocument(String patientId, PatientDocument request) {
        assertManageAccess(patientId);
        validateConditionLink(patientId, request.getConditionId());
        LocalDateTime now = LocalDateTime.now();
        request.setId(null);
        request.setPatientId(patientId);
        request.setCreatedAt(now);
        request.setUpdatedAt(now);
        encryptDocument(request);
        PatientDocument saved = decryptDocument(documentRepository.save(request));
        evictPatientHistory(patientId);
        return saved;
    }

    public PatientDocument uploadDocument(String patientId, MultipartFile file, String type, LocalDate date,
                                          String conditionId, String encounterId, String admissionId,
                                          String documentPhase, String notes) {
        assertManageAccess(patientId);
        validateConditionLink(patientId, conditionId);

        String safeName = "Clinical_Note_" + LocalDate.now().toString();
        String objectKey = null;

        if (file != null && !file.isEmpty()) {
            String originalName = file.getOriginalFilename() == null ? "document" : file.getOriginalFilename();
            safeName = originalName.replaceAll("[^A-Za-z0-9._-]", "_");
            objectKey = supabaseStorageService.uploadFile(patientId, file);
        }

        PatientDocument document = new PatientDocument();
        document.setId(UUID.randomUUID().toString());
        document.setPatientId(patientId);
        document.setConditionId(conditionId);
        document.setEncounterId(encounterId);
        document.setAdmissionId(admissionId);
        document.setType(type);
        document.setDocumentPhase(normalizeDocumentPhase(documentPhase));
        document.setFileName(safeName);
        if (objectKey != null) {
            document.setFileUrl(documentFileUrl(patientId, document.getId()));
            document.setStoredFileUrl(objectKey);
        }
        document.setDate(date);
        document.setNotes(notes);
        LocalDateTime now = LocalDateTime.now();
        document.setCreatedAt(now);
        document.setUpdatedAt(now);
        encryptDocument(document);
        PatientDocument saved = decryptDocument(documentRepository.save(document));
        evictPatientHistory(patientId);
        return saved;
    }

    public PatientDocument updateDocument(String patientId, String id, PatientDocument request) {
        assertManageAccess(patientId);
        PatientDocument existing = findPatientOwnedDocument(patientId, id);
        if (request.getConditionId() != null) {
            validateConditionLink(patientId, request.getConditionId());
            existing.setConditionId(request.getConditionId());
        }
        if (request.getEncounterId() != null) existing.setEncounterId(request.getEncounterId());
        if (request.getAdmissionId() != null) existing.setAdmissionId(request.getAdmissionId());
        if (request.getType() != null) existing.setType(request.getType());
        if (request.getDocumentPhase() != null) existing.setDocumentPhase(normalizeDocumentPhase(request.getDocumentPhase()));
        if (request.getFileName() != null) existing.setFileName(request.getFileName());
        if (request.getFileUrl() != null) existing.setFileUrl(request.getFileUrl());
        if (request.getDate() != null) existing.setDate(request.getDate());
        if (request.getNotes() != null) existing.setNotes(request.getNotes());
        existing.setUpdatedAt(LocalDateTime.now());
        encryptDocument(existing);
        PatientDocument saved = decryptDocument(documentRepository.save(existing));
        evictPatientHistory(patientId);
        return saved;
    }

    public PatientDocument updateDocument(String patientId, String id, MultipartFile file, String type, LocalDate date,
                                          String fileName, String conditionId, String encounterId, String admissionId,
                                          String documentPhase, String notes) {
        assertManageAccess(patientId);
        PatientDocument existing = findPatientOwnedDocument(patientId, id);
        if (conditionId != null) {
            validateConditionLink(patientId, conditionId);
            existing.setConditionId(conditionId);
        }
        if (encounterId != null) existing.setEncounterId(encounterId);
        if (admissionId != null) existing.setAdmissionId(admissionId);
        if (type != null) existing.setType(type);
        if (documentPhase != null) existing.setDocumentPhase(normalizeDocumentPhase(documentPhase));
        if (date != null) existing.setDate(date);
        if (notes != null) existing.setNotes(notes);
        if (fileName != null && !fileName.isBlank()) existing.setFileName(fileName);

        if (file != null && !file.isEmpty()) {
            // Delete the previous S3 object (only if it is a Supabase key, not a legacy local path)
            String oldObjectKey = phiCryptoService.decrypt(existing.getStoredFileUrl());
            if (oldObjectKey != null && !oldObjectKey.isBlank() && !oldObjectKey.startsWith("/files/")) {
                supabaseStorageService.deleteFile(oldObjectKey);
            }
            String originalName = file.getOriginalFilename() == null ? "document" : file.getOriginalFilename();
            String safeName = (fileName != null && !fileName.isBlank()) ? fileName : originalName.replaceAll("[^A-Za-z0-9._-]", "_");
            String objectKey = supabaseStorageService.uploadFile(patientId, file);
            existing.setFileName(safeName);
            existing.setFileUrl(documentFileUrl(patientId, id));
            existing.setStoredFileUrl(objectKey);
        }
        existing.setUpdatedAt(LocalDateTime.now());
        encryptDocument(existing);
        PatientDocument saved = decryptDocument(documentRepository.save(existing));
        evictPatientHistory(patientId);
        return saved;
    }

    /**
     * Returns a URL to access the document:
     * - For Supabase-stored documents: a short-lived pre-signed URL.
     * - For legacy locally-stored documents (/files/...): the direct static resource URL
     *   served by the backend (CorsConfig registers /files/** as a public static handler).
     */
    public String getDocumentSignedUrl(String patientId, String id) {
        assertPatientAccess(patientId);
        PatientDocument document = decryptDocument(findPatientOwnedDocument(patientId, id));
        String objectKey = document.getStoredFileUrl();
        if (objectKey == null || objectKey.isBlank()) {
            throw new ResourceNotFoundException("Document file not found");
        }
        // Legacy documents were saved to a local /files/ directory which is still
        // served as a static resource by CorsConfig — return the direct URL.
        if (objectKey.startsWith("/files/")) {
            return objectKey;
        }
        return supabaseStorageService.generateSignedUrl(objectKey);
    }



    public void deleteDocument(String patientId, String id) {
        assertManageAccess(patientId);
        PatientDocument existing = decryptDocument(findPatientOwnedDocument(patientId, id));
        // Best-effort S3 cleanup — failures are logged but not re-thrown
        String objectKey = existing.getStoredFileUrl();
        if (objectKey != null && !objectKey.isBlank() && !objectKey.startsWith("/files/")) {
            supabaseStorageService.deleteFile(objectKey);
        }
        documentRepository.deleteById(id);
        evictPatientHistory(patientId);
    }

    private List<PatientTimelineEventDTO> buildTimeline(String patientId,
                                                       List<PatientCondition> conditions,
                                                       List<PatientMedication> medications,
                                                       List<PatientEncounter> encounters,
                                                       List<PatientAdmission> admissions,
                                                       List<PatientLabResult> labResults,
                                                       List<PatientVital> vitals,
                                                       List<PatientDocument> documents,
                                                       List<PatientClinicalOrder> clinicalOrders,
                                                       List<PatientCareRecord> epcrRecords) {
        List<PatientTimelineEventDTO> events = new ArrayList<>();
        for (PatientCondition condition : conditions) {
            if (condition.getDateDiagnosed() != null) {
                events.add(event(condition.getDateDiagnosed(), TimelineEventType.CONDITION_DIAGNOSED, condition.getId(),
                        patientId, condition.getId(), "Diagnosed: " + condition.getName(),
                        statusText(condition.getStatus()), Map.of("severity", value(condition.getSeverity()))));
            }
            if (condition.getDateResolved() != null) {
                events.add(event(condition.getDateResolved(), TimelineEventType.CONDITION_RESOLVED, condition.getId(),
                        patientId, condition.getId(), "Resolved: " + condition.getName(), condition.getNotes(),
                        Map.of("status", value(condition.getStatus()))));
            }
        }
        for (PatientMedication medication : medications) {
            if (medication.getStartDate() != null) {
                events.add(event(medication.getStartDate(), TimelineEventType.MEDICATION_STARTED, medication.getId(),
                        patientId, medication.getConditionId(), "Started: " + medication.getName(),
                        medication.getDosage(), medicationMetadata(medication)));
            }
            if (medication.getEndDate() != null) {
                events.add(event(medication.getEndDate(), TimelineEventType.MEDICATION_STOPPED, medication.getId(),
                        patientId, medication.getConditionId(), "Stopped: " + medication.getName(),
                        medication.getNotes(), medicationMetadata(medication)));
            }
        }
        for (PatientEncounter encounter : encounters) {
            events.add(event(encounter.getDate(), TimelineEventType.EPCR_ENCOUNTER, encounter.getId(), patientId,
                    encounter.getConditionId(), "ePCR: " + value(encounter.getChiefComplaint()), encounter.getOutcome(),
                    encounterMetadata(encounter)));
        }
        Set<String> linkedEpcrIds = encounters.stream()
                .map(PatientEncounter::getEpcrRecordId)
                .filter(id -> id != null && !id.isBlank())
                .collect(Collectors.toSet());
        for (PatientCareRecord record : epcrRecords) {
            if (linkedEpcrIds.contains(record.getId())) {
                continue;
            }
            LocalDate date = record.getIncidentDateTime() == null ? null : record.getIncidentDateTime().toLocalDate();
            String incidentDescription = phiCryptoService.decrypt(record.getIncidentDescription());
            String primaryImpression = phiCryptoService.decrypt(record.getPrimaryImpression());
            events.add(event(date, TimelineEventType.EPCR_ENCOUNTER, record.getId(), patientId, null,
                    "ePCR: " + value(incidentDescription), primaryImpression,
                    epcrMetadata(record)));
        }
        for (PatientAdmission admission : admissions) {
            events.add(event(admission.getAdmitDate(), TimelineEventType.HOSPITAL_ADMISSION, admission.getId(),
                    patientId, admission.getConditionId(), "Admitted: " + value(admission.getHospital()),
                    admission.getReason(), Map.of("dischargeDate", value(admission.getDischargeDate()))));
        }
        for (PatientLabResult labResult : labResults) {
            events.add(event(labResult.getDate(), TimelineEventType.LAB_RESULT, labResult.getId(), patientId,
                    labResult.getConditionId(), "Lab: " + value(labResult.getTestName()),
                    labResult.getValue() + valueWithPrefix(" ", labResult.getUnit()), labMetadata(labResult)));
        }
        for (PatientVital vital : vitals) {
            events.add(event(vitalDate(vital), TimelineEventType.VITALS_READING, vital.getId(), patientId, null,
                    "Vitals: " + vitalSummary(vital), value(vital.getNotes()), vitalMetadata(vital)));
        }
        for (PatientDocument document : documents) {
            events.add(event(document.getDate(), TimelineEventType.DOCUMENT, document.getId(), patientId,
                    document.getConditionId(), "Document: " + value(document.getFileName()), document.getType(),
                    Map.of(
                            "fileUrl", value(document.getFileUrl()),
                            "encounterId", value(document.getEncounterId()),
                            "documentPhase", value(document.getDocumentPhase())
                    )));
        }
        for (PatientClinicalOrder order : clinicalOrders) {
            events.add(event(order.getStartDate(), TimelineEventType.CLINICAL_ORDER, order.getId(), patientId,
                    null, "Clinical Order: " + value(order.getOrderName()), order.getInstructions(),
                    Map.of(
                            "orderType", value(order.getOrderType()),
                            "status", value(order.getStatus()),
                            "frequency", value(order.getFrequency()),
                            "endDate", value(order.getEndDate()),
                            "orderingClinicianName", value(order.getOrderingClinicianName()),
                            "notes", value(order.getNotes())
                    )));
        }
        events.sort(Comparator.comparing(PatientTimelineEventDTO::getDate,
                Comparator.nullsLast(Comparator.reverseOrder())));
        return events;
    }

    private PatientTimelineEventDTO event(LocalDate date, TimelineEventType type, String sourceId, String patientId,
                                          String conditionId, String title, String description,
                                          Map<String, Object> metadata) {
        return new PatientTimelineEventDTO(date, type, sourceId, patientId, conditionId, title, description, metadata);
    }

    private Map<String, Object> medicationMetadata(PatientMedication medication) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("dosage", value(medication.getDosage()));
        metadata.put("frequency", value(medication.getFrequency()));
        metadata.put("status", value(medication.getStatus()));
        return metadata;
    }

    private Map<String, Object> encounterMetadata(PatientEncounter encounter) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("epcrRecordId", value(encounter.getEpcrRecordId()));
        metadata.put("notes", value(encounter.getNotes()));
        if (encounter.getEpcrRecordId() == null || encounter.getEpcrRecordId().isBlank()) {
            return metadata;
        }
        epcrRepository.findByIdAndPatientId(encounter.getEpcrRecordId(), encounter.getPatientId())
                .ifPresent(record -> metadata.putAll(epcrMetadata(record)));
        return metadata;
    }

    private Map<String, Object> epcrMetadata(PatientCareRecord record) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("incidentNumber", value(record.getIncidentNumber()));
        metadata.put("status", value(record.getStatus()));
        metadata.put("incidentType", value(record.getIncidentType()));
        metadata.put("incidentDateTime", value(record.getIncidentDateTime()));
        metadata.put("diagnosis", value(phiCryptoService.decrypt(record.getDiagnosis())));
        metadata.put("treatmentProvided", value(phiCryptoService.decrypt(record.getTreatmentProvided())));
        metadata.put("treatmentPlan", value(phiCryptoService.decrypt(record.getTreatmentPlan())));
        metadata.put("dietAdvice", phiCryptoService.decryptList(record.getDietAdvice()));
        metadata.put("notes", phiCryptoService.decryptList(record.getNotes()));
        metadata.put("medicalHistoryNotes", record.getMedicalHistory() == null ? null : record.getMedicalHistory().getNotes());
        metadata.put("complaints", phiCryptoService.decryptList(record.getComplaints()));
        metadata.put("vitals", phiCryptoService.decryptList(record.getVitals()));
        metadata.put("medicationsAdministered", phiCryptoService.decryptList(record.getMedicationsAdministered()));
        return metadata;
    }

    private Map<String, Object> labMetadata(PatientLabResult labResult) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("normalRange", value(labResult.getNormalRange()));
        metadata.put("interpretation", value(labResult.getInterpretation()));
        metadata.put("unit", value(labResult.getUnit()));
        return metadata;
    }

    private Map<String, Object> vitalMetadata(PatientVital vital) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("recordedAt", value(vital.getRecordedAt()));
        metadata.put("recordedByName", value(vital.getRecordedByName()));
        metadata.put("bloodPressure", bloodPressure(vital));
        metadata.put("heartRate", vital.getHeartRate());
        metadata.put("oxygenSaturation", vital.getOxygenSaturation());
        metadata.put("temperature", vital.getTemperature());
        metadata.put("respiratoryRate", vital.getRespiratoryRate());
        metadata.put("bloodGlucose", vital.getBloodGlucose());
        metadata.put("glasgowComaScale", vital.getGlasgowComaScale());
        metadata.put("painScore", vital.getPainScore());
        metadata.put("linkedEpcrId", value(vital.getLinkedEpcrId()));
        return metadata;
    }

    private LocalDate vitalDate(PatientVital vital) {
        return vital.getRecordedAt() == null ? null : vital.getRecordedAt().toLocalDate();
    }

    private String vitalSummary(PatientVital vital) {
        List<String> parts = new ArrayList<>();
        String bloodPressure = bloodPressure(vital);
        if (!bloodPressure.isBlank()) parts.add("BP " + bloodPressure);
        if (vital.getHeartRate() != null) parts.add("HR " + vital.getHeartRate());
        if (vital.getOxygenSaturation() != null) parts.add("SpO2 " + vital.getOxygenSaturation());
        if (vital.getTemperature() != null) parts.add("Temp " + vital.getTemperature());
        return parts.isEmpty() ? "Recorded" : String.join(", ", parts);
    }

    private String bloodPressure(PatientVital vital) {
        if (vital.getSystolicBP() == null && vital.getDiastolicBP() == null) {
            return "";
        }
        return value(vital.getSystolicBP()) + "/" + value(vital.getDiastolicBP());
    }

    private String statusText(ConditionStatus status) {
        return status == null ? null : status.name();
    }

    private String value(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private String valueWithPrefix(String prefix, Object value) {
        return value == null ? "" : prefix + value;
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private String normalizedKey(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim().toLowerCase(Locale.ENGLISH);
        return normalized.isBlank() ? null : normalized;
    }

    private List<String> compactConditionNames(List<String> rawNames) {
        if (rawNames == null || rawNames.isEmpty()) {
            return List.of();
        }
        List<String> cleaned = rawNames.stream()
                .filter(value -> value != null && !value.isBlank())
                .map(String::trim)
                .distinct()
                .toList();

        // Merge near-duplicates produced from diagnosis/primary/secondary/comorbidity variants.
        List<String> compacted = new ArrayList<>();
        for (String candidate : cleaned) {
            String normalizedCandidate = normalizedComparison(candidate);
            if (normalizedCandidate == null) {
                continue;
            }
            boolean merged = false;
            for (int i = 0; i < compacted.size(); i++) {
                String existing = compacted.get(i);
                String normalizedExisting = normalizedComparison(existing);
                if (normalizedExisting == null) {
                    continue;
                }
                if (normalizedExisting.contains(normalizedCandidate) || normalizedCandidate.contains(normalizedExisting)) {
                    // Keep the more informative string (usually longer).
                    compacted.set(i, candidate.length() > existing.length() ? candidate : existing);
                    merged = true;
                    break;
                }
            }
            if (!merged) {
                compacted.add(candidate);
            }
        }
        return compacted;
    }

    private List<PatientMedication> dedupeMedications(List<PatientMedication> medications) {
        if (medications == null || medications.isEmpty()) {
            return List.of();
        }
        Map<String, PatientMedication> unique = new LinkedHashMap<>();
        for (PatientMedication medication : medications) {
            if (medication == null) {
                continue;
            }
            String name = normalizedComparison(medication.getName());
            if (name == null) {
                continue;
            }
            String dosage = normalizedComparison(medication.getDosage());
            String key = name + "|" + (dosage == null ? "" : dosage);
            unique.putIfAbsent(key, medication);
        }
        return new ArrayList<>(unique.values());
    }

    private String normalizedComparison(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.toLowerCase(Locale.ENGLISH)
                .replaceAll("[^a-z0-9 ]", " ")
                .replaceAll("\\s+", " ")
                .trim();
        return normalized.isBlank() ? null : normalized;
    }

    private String selectPrimaryConditionName(PatientCareRecord record, List<String> compacted) {
        if (record == null || compacted == null || compacted.isEmpty()) {
            return null;
        }
        List<String> candidates = new ArrayList<>();
        candidates.add(record.getDiagnosis());
        candidates.add(record.getPrimaryImpression());
        candidates.add(record.getComorbidity());
        candidates.add(record.getSecondaryImpression());
        for (String candidate : candidates) {
            String normalizedCandidate = normalizedComparison(candidate);
            if (normalizedCandidate == null) {
                continue;
            }
            for (String name : compacted) {
                String normalizedName = normalizedComparison(name);
                if (normalizedName == null) {
                    continue;
                }
                if (normalizedName.contains(normalizedCandidate) || normalizedCandidate.contains(normalizedName)) {
                    return name;
                }
            }
        }
        return compacted.get(0);
    }

    private String documentFileUrl(String patientId, String documentId) {
        return "/api/patients/" + patientId + "/history/documents/" + documentId + "/file";
    }

    private String normalizeDocumentPhase(String documentPhase) {
        if (documentPhase == null || documentPhase.isBlank()) {
            return null;
        }
        String normalized = documentPhase.trim().toUpperCase(Locale.ROOT);
        if (!"PRE".equals(normalized) && !"POST".equals(normalized)) {
            throw new IllegalArgumentException("documentPhase must be PRE or POST");
        }
        return normalized;
    }

    private void encryptCondition(PatientCondition condition) {
        if (condition == null) return;
        condition.setName(phiCryptoService.encrypt(condition.getName()));
        condition.setSeverity(phiCryptoService.encrypt(condition.getSeverity()));
        condition.setNotes(phiCryptoService.encrypt(condition.getNotes()));
        condition.setFindings(phiCryptoService.encrypt(condition.getFindings()));
        condition.setSymptoms(phiCryptoService.encrypt(condition.getSymptoms()));
        condition.setAnalysis(phiCryptoService.encrypt(condition.getAnalysis()));
        condition.setRecommendedTreatment(phiCryptoService.encrypt(condition.getRecommendedTreatment()));
    }

    private PatientCondition decryptCondition(PatientCondition source) {
        if (source == null) return null;
        PatientCondition copy = new PatientCondition();
        copy.setId(source.getId());
        copy.setPatientId(source.getPatientId());
        copy.setLinkedEpcrId(source.getLinkedEpcrId());
        copy.setName(phiCryptoService.decrypt(source.getName()));
        copy.setStatus(source.getStatus());
        copy.setSeverity(phiCryptoService.decrypt(source.getSeverity()));
        copy.setDateDiagnosed(source.getDateDiagnosed());
        copy.setDateResolved(source.getDateResolved());
        copy.setNotes(phiCryptoService.decrypt(source.getNotes()));
        copy.setFindings(phiCryptoService.decrypt(source.getFindings()));
        copy.setSymptoms(phiCryptoService.decrypt(source.getSymptoms()));
        copy.setAnalysis(phiCryptoService.decrypt(source.getAnalysis()));
        copy.setRecommendedTreatment(phiCryptoService.decrypt(source.getRecommendedTreatment()));
        copy.setCreatedAt(source.getCreatedAt());
        copy.setUpdatedAt(source.getUpdatedAt());
        return copy;
    }

    private List<PatientCondition> decryptConditions(List<PatientCondition> conditions) {
        return conditions == null ? List.of() : conditions.stream().map(this::decryptCondition).collect(Collectors.toList());
    }

    private void encryptMedication(PatientMedication medication) {
        if (medication == null) return;
        medication.setName(phiCryptoService.encrypt(medication.getName()));
        medication.setDosage(phiCryptoService.encrypt(medication.getDosage()));
        medication.setFrequency(phiCryptoService.encrypt(medication.getFrequency()));
        medication.setNotes(phiCryptoService.encrypt(medication.getNotes()));
    }

    private PatientMedication decryptMedication(PatientMedication source) {
        if (source == null) return null;
        PatientMedication copy = new PatientMedication();
        copy.setId(source.getId());
        copy.setPatientId(source.getPatientId());
        copy.setConditionId(source.getConditionId());
        copy.setLinkedEpcrId(source.getLinkedEpcrId());
        copy.setName(phiCryptoService.decrypt(source.getName()));
        copy.setDosage(phiCryptoService.decrypt(source.getDosage()));
        copy.setFrequency(phiCryptoService.decrypt(source.getFrequency()));
        copy.setStatus(source.getStatus());
        copy.setStartDate(source.getStartDate());
        copy.setEndDate(source.getEndDate());
        copy.setNotes(phiCryptoService.decrypt(source.getNotes()));
        copy.setCreatedAt(source.getCreatedAt());
        copy.setUpdatedAt(source.getUpdatedAt());
        return copy;
    }

    private List<PatientMedication> decryptMedications(List<PatientMedication> medications) {
        return medications == null ? List.of() : medications.stream().map(this::decryptMedication).collect(Collectors.toList());
    }

    private void encryptEncounter(PatientEncounter encounter) {
        if (encounter == null) return;
        encounter.setChiefComplaint(phiCryptoService.encrypt(encounter.getChiefComplaint()));
        encounter.setOutcome(phiCryptoService.encrypt(encounter.getOutcome()));
        encounter.setNotes(phiCryptoService.encrypt(encounter.getNotes()));
    }

    private PatientEncounter decryptEncounter(PatientEncounter source) {
        if (source == null) return null;
        PatientEncounter copy = new PatientEncounter();
        copy.setId(source.getId());
        copy.setPatientId(source.getPatientId());
        copy.setConditionId(source.getConditionId());
        copy.setEpcrRecordId(source.getEpcrRecordId());
        copy.setDate(source.getDate());
        copy.setChiefComplaint(phiCryptoService.decrypt(source.getChiefComplaint()));
        copy.setOutcome(phiCryptoService.decrypt(source.getOutcome()));
        copy.setActiveConditionIds(source.getActiveConditionIds());
        copy.setNotes(phiCryptoService.decrypt(source.getNotes()));
        copy.setCreatedAt(source.getCreatedAt());
        copy.setUpdatedAt(source.getUpdatedAt());
        return copy;
    }

    private List<PatientEncounter> decryptEncounters(List<PatientEncounter> encounters) {
        return encounters == null ? List.of() : encounters.stream().map(this::decryptEncounter).collect(Collectors.toList());
    }

    private void encryptAdmission(PatientAdmission admission) {
        if (admission == null) return;
        admission.setHospital(phiCryptoService.encrypt(admission.getHospital()));
        admission.setReason(phiCryptoService.encrypt(admission.getReason()));
        admission.setOutcome(phiCryptoService.encrypt(admission.getOutcome()));
        admission.setNotes(phiCryptoService.encrypt(admission.getNotes()));
    }

    private PatientAdmission decryptAdmission(PatientAdmission source) {
        if (source == null) return null;
        PatientAdmission copy = new PatientAdmission();
        copy.setId(source.getId());
        copy.setPatientId(source.getPatientId());
        copy.setConditionId(source.getConditionId());
        copy.setHospital(phiCryptoService.decrypt(source.getHospital()));
        copy.setAdmitDate(source.getAdmitDate());
        copy.setDischargeDate(source.getDischargeDate());
        copy.setReason(phiCryptoService.decrypt(source.getReason()));
        copy.setOutcome(phiCryptoService.decrypt(source.getOutcome()));
        copy.setNotes(phiCryptoService.decrypt(source.getNotes()));
        copy.setCreatedAt(source.getCreatedAt());
        copy.setUpdatedAt(source.getUpdatedAt());
        return copy;
    }

    private List<PatientAdmission> decryptAdmissions(List<PatientAdmission> admissions) {
        return admissions == null ? List.of() : admissions.stream().map(this::decryptAdmission).collect(Collectors.toList());
    }

    private void encryptLabResult(PatientLabResult labResult) {
        if (labResult == null) return;
        labResult.setTestName(phiCryptoService.encrypt(labResult.getTestName()));
        labResult.setValue(phiCryptoService.encrypt(labResult.getValue()));
        labResult.setUnit(phiCryptoService.encrypt(labResult.getUnit()));
        labResult.setNormalRange(phiCryptoService.encrypt(labResult.getNormalRange()));
        labResult.setInterpretation(phiCryptoService.encrypt(labResult.getInterpretation()));
        labResult.setNotes(phiCryptoService.encrypt(labResult.getNotes()));
    }

    private PatientLabResult decryptLabResult(PatientLabResult source) {
        if (source == null) return null;
        PatientLabResult copy = new PatientLabResult();
        copy.setId(source.getId());
        copy.setPatientId(source.getPatientId());
        copy.setConditionId(source.getConditionId());
        copy.setTestName(phiCryptoService.decrypt(source.getTestName()));
        copy.setValue(phiCryptoService.decrypt(source.getValue()));
        copy.setUnit(phiCryptoService.decrypt(source.getUnit()));
        copy.setNormalRange(phiCryptoService.decrypt(source.getNormalRange()));
        copy.setDate(source.getDate());
        copy.setInterpretation(phiCryptoService.decrypt(source.getInterpretation()));
        copy.setNotes(phiCryptoService.decrypt(source.getNotes()));
        copy.setCreatedAt(source.getCreatedAt());
        copy.setUpdatedAt(source.getUpdatedAt());
        return copy;
    }

    private List<PatientLabResult> decryptLabResults(List<PatientLabResult> labResults) {
        return labResults == null ? List.of() : labResults.stream().map(this::decryptLabResult).collect(Collectors.toList());
    }

    private void encryptVital(PatientVital vital) {
        if (vital == null) return;
        vital.setRecordedByName(phiCryptoService.encrypt(vital.getRecordedByName()));
        vital.setOxygenDeliveryMethod(phiCryptoService.encrypt(vital.getOxygenDeliveryMethod()));
        vital.setAvpu(phiCryptoService.encrypt(vital.getAvpu()));
        vital.setPainLocation(phiCryptoService.encrypt(vital.getPainLocation()));
        vital.setTemperatureRoute(phiCryptoService.encrypt(vital.getTemperatureRoute()));
        vital.setPupilLeft(phiCryptoService.encrypt(vital.getPupilLeft()));
        vital.setPupilRight(phiCryptoService.encrypt(vital.getPupilRight()));
        vital.setSkinColor(phiCryptoService.encrypt(vital.getSkinColor()));
        vital.setSkinCondition(phiCryptoService.encrypt(vital.getSkinCondition()));
        vital.setSkinTemperature(phiCryptoService.encrypt(vital.getSkinTemperature()));
        vital.setNotes(phiCryptoService.encrypt(vital.getNotes()));
    }

    private PatientVital decryptVital(PatientVital source) {
        if (source == null) return null;
        PatientVital copy = new PatientVital();
        copy.setId(source.getId());
        copy.setPatientId(source.getPatientId());
        copy.setOrganizationId(source.getOrganizationId());
        copy.setRecordedBy(source.getRecordedBy());
        copy.setRecordedByName(phiCryptoService.decrypt(source.getRecordedByName()));
        copy.setRecordedAt(source.getRecordedAt());
        copy.setLinkedEpcrId(source.getLinkedEpcrId());
        copy.setLinkedEncounterId(source.getLinkedEncounterId());
        copy.setSystolicBP(source.getSystolicBP());
        copy.setDiastolicBP(source.getDiastolicBP());
        copy.setHeartRate(source.getHeartRate());
        copy.setPulseRate(source.getPulseRate());
        copy.setOxygenSaturation(source.getOxygenSaturation());
        copy.setRespiratoryRate(source.getRespiratoryRate());
        copy.setOxygenDeliveryMethod(phiCryptoService.decrypt(source.getOxygenDeliveryMethod()));
        copy.setGlasgowComaScale(source.getGlasgowComaScale());
        copy.setGcEye(source.getGcEye());
        copy.setGcVerbal(source.getGcVerbal());
        copy.setGcMotor(source.getGcMotor());
        copy.setAvpu(phiCryptoService.decrypt(source.getAvpu()));
        copy.setPainScore(source.getPainScore());
        copy.setPainLocation(phiCryptoService.decrypt(source.getPainLocation()));
        copy.setTemperature(source.getTemperature());
        copy.setTemperatureRoute(phiCryptoService.decrypt(source.getTemperatureRoute()));
        copy.setBloodGlucose(source.getBloodGlucose());
        copy.setHemoglobin(source.getHemoglobin());
        copy.setPupilLeft(phiCryptoService.decrypt(source.getPupilLeft()));
        copy.setPupilRight(phiCryptoService.decrypt(source.getPupilRight()));
        copy.setPupilsEqual(source.getPupilsEqual());
        copy.setPupilsReactive(source.getPupilsReactive());
        copy.setSkinColor(phiCryptoService.decrypt(source.getSkinColor()));
        copy.setSkinCondition(phiCryptoService.decrypt(source.getSkinCondition()));
        copy.setSkinTemperature(phiCryptoService.decrypt(source.getSkinTemperature()));
        copy.setNotes(phiCryptoService.decrypt(source.getNotes()));
        copy.setCreatedAt(source.getCreatedAt());
        copy.setUpdatedAt(source.getUpdatedAt());
        return copy;
    }

    private List<PatientVital> decryptVitals(List<PatientVital> vitals) {
        return vitals == null ? List.of() : vitals.stream().map(this::decryptVital).collect(Collectors.toList());
    }

    private void encryptDocument(PatientDocument document) {
        if (document == null) return;
        document.setType(phiCryptoService.encrypt(document.getType()));
        document.setDocumentPhase(phiCryptoService.encrypt(document.getDocumentPhase()));
        document.setFileName(phiCryptoService.encrypt(document.getFileName()));
        document.setFileUrl(phiCryptoService.encrypt(document.getFileUrl()));
        document.setStoredFileUrl(phiCryptoService.encrypt(document.getStoredFileUrl()));
        document.setNotes(phiCryptoService.encrypt(document.getNotes()));
    }

    private PatientDocument decryptDocument(PatientDocument source) {
        if (source == null) return null;
        PatientDocument copy = new PatientDocument();
        copy.setId(source.getId());
        copy.setPatientId(source.getPatientId());
        copy.setConditionId(source.getConditionId());
        copy.setEncounterId(source.getEncounterId());
        copy.setAdmissionId(source.getAdmissionId());
        copy.setType(safeDecrypt(source.getType()));
        copy.setDocumentPhase(safeDecrypt(source.getDocumentPhase()));
        copy.setFileName(safeDecrypt(source.getFileName()));
        String fileUrl = safeDecrypt(source.getFileUrl());
        String storedFileUrl = safeDecrypt(source.getStoredFileUrl());
        if ((storedFileUrl == null || storedFileUrl.isBlank()) && fileUrl != null && fileUrl.startsWith("/files/")) {
            storedFileUrl = fileUrl;
        }
        copy.setStoredFileUrl(storedFileUrl);
        copy.setFileUrl(storedFileUrl == null || storedFileUrl.isBlank()
                ? fileUrl
                : documentFileUrl(source.getPatientId(), source.getId()));
        copy.setDate(source.getDate());
        copy.setNotes(safeDecrypt(source.getNotes()));
        copy.setCreatedAt(source.getCreatedAt());
        copy.setUpdatedAt(source.getUpdatedAt());
        return copy;
    }

    private List<PatientDocument> decryptDocuments(List<PatientDocument> documents) {
        return documents == null ? List.of() : documents.stream().map(this::decryptDocument).collect(Collectors.toList());
    }

    private String safeDecrypt(String value) {
        if (value == null || value.isBlank()) {
            return value;
        }
        try {
            return phiCryptoService.decrypt(value);
        } catch (IllegalStateException ex) {
            return value;
        }
    }

    private String assertPatientAccess(String patientId) {
        String normalizedPatientId = patientId;
        if (normalizedPatientId != null) {
            normalizedPatientId = normalizedPatientId.trim().toUpperCase(Locale.ENGLISH);
        }
        PatientPrincipal patientPrincipal = currentPatientPrincipal();
        final String lookupPatientId = normalizedPatientId;
        Optional<Patient> patientOptional = patientRepository.findByPatientId(lookupPatientId)
                .or(() -> patientRepository.findById(lookupPatientId));
        if (patientOptional.isEmpty()) {
            if (patientPrincipal != null) {
                if (matchesPatientPrincipal(lookupPatientId, patientPrincipal)) {
                    return lookupPatientId; // Valid authenticated patient requesting their own history, even if empty
                }
                throw new IllegalArgumentException("Patients can only view their own history");
            }
            if (!epcrRepository.existsByPatientId(lookupPatientId)) {
                throw new ResourceNotFoundException("Patient not found with id: " + lookupPatientId);
            }
            return lookupPatientId;
        }
        Patient patient = patientOptional.get();
        if (patientPrincipal != null) {
            boolean ownPatient = matchesPatientPrincipal(lookupPatientId, patientPrincipal)
                    || matchesPatientPrincipal(patient.getPatientId(), patientPrincipal)
                    || matchesPatientPrincipal(patient.getId(), patientPrincipal);
            if (!ownPatient) {
                throw new IllegalArgumentException("Patients can only view their own history");
            }
            if (patient.getOrganizationId() == null || !patient.getOrganizationId().equals(patientPrincipal.organizationId())) {
                throw new IllegalArgumentException("Access denied for patient history");
            }
            return lookupPatientId;
        }
        accessControlService.assertOrganizationAccess(patient.getOrganizationId());
        return lookupPatientId;
    }

    private boolean matchesPatientPrincipal(String patientId, PatientPrincipal patientPrincipal) {
        if (patientId == null || patientPrincipal == null) {
            return false;
        }
        return patientId.equals(patientPrincipal.patientId()) || patientId.equals(patientPrincipal.subject());
    }

    private String assertManageAccess(String patientId) {
        return assertPatientAccess(patientId);
    }

    private void evictPatientHistory(String patientId) {
        patientHistoryCacheService.evictPatientHistory(patientId);
    }

    private PatientPrincipal currentPatientPrincipal() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof PatientPrincipal patientPrincipal) {
            return patientPrincipal;
        }
        return null;
    }

    private void validateConditionLink(String patientId, String conditionId) {
        if (conditionId == null || conditionId.isBlank()) {
            return;
        }
        findPatientOwnedCondition(patientId, conditionId);
    }

    private void validateEpcrLink(String patientId, String epcrRecordId) {
        if (epcrRecordId == null || epcrRecordId.isBlank()) {
            return;
        }
        epcrRepository.findByIdAndPatientId(epcrRecordId, patientId)
                .orElseThrow(() -> new ResourceNotFoundException("ePCR record not found for patient"));
    }

    private String resolveOrganizationId(String patientId) {
        return patientRepository.findByPatientId(patientId)
                .or(() -> patientRepository.findById(patientId))
                .map(Patient::getOrganizationId)
                .orElse(null);
    }

    private String currentActorName() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            return null;
        }
        return authentication.getName();
    }

    private PatientCondition findPatientOwnedCondition(String patientId, String id) {
        return conditionRepository.findById(id)
                .filter(item -> patientId.equals(item.getPatientId()))
                .orElseThrow(() -> new ResourceNotFoundException("Condition not found with id: " + id));
    }

    private PatientMedication findPatientOwnedMedication(String patientId, String id) {
        return medicationRepository.findById(id)
                .filter(item -> patientId.equals(item.getPatientId()))
                .orElseThrow(() -> new ResourceNotFoundException("Medication not found with id: " + id));
    }

    private PatientEncounter findPatientOwnedEncounter(String patientId, String id) {
        return encounterRepository.findById(id)
                .filter(item -> patientId.equals(item.getPatientId()))
                .orElseThrow(() -> new ResourceNotFoundException("Encounter not found with id: " + id));
    }

    private PatientAdmission findPatientOwnedAdmission(String patientId, String id) {
        return admissionRepository.findById(id)
                .filter(item -> patientId.equals(item.getPatientId()))
                .orElseThrow(() -> new ResourceNotFoundException("Admission not found with id: " + id));
    }

    private PatientLabResult findPatientOwnedLabResult(String patientId, String id) {
        return labResultRepository.findById(id)
                .filter(item -> patientId.equals(item.getPatientId()))
                .orElseThrow(() -> new ResourceNotFoundException("Lab result not found with id: " + id));
    }

    private PatientVital findPatientOwnedVital(String patientId, String id) {
        return vitalRepository.findById(id)
                .filter(item -> patientId.equals(item.getPatientId()))
                .orElseThrow(() -> new ResourceNotFoundException("Vital reading not found with id: " + id));
    }

    private PatientDocument findPatientOwnedDocument(String patientId, String id) {
        return documentRepository.findById(id)
                .filter(item -> patientId.equals(item.getPatientId()))
                .orElseThrow(() -> new ResourceNotFoundException("Document not found with id: " + id));
    }

    private PatientClinicalOrder findPatientOwnedClinicalOrder(String patientId, String id) {
        return clinicalOrderRepository.findById(id)
                .filter(item -> patientId.equals(item.getPatientId()))
                .orElseThrow(() -> new ResourceNotFoundException("Clinical order not found with id: " + id));
    }

    public List<PatientClinicalOrder> getClinicalOrders(String patientId) {
        return getSummary(patientId).getClinicalOrders();
    }

    public PatientClinicalOrder createClinicalOrder(String patientId, PatientClinicalOrder request) {
        assertManageAccess(patientId);
        validateEpcrLink(patientId, request.getLinkedEpcrId());
        LocalDateTime now = LocalDateTime.now();
        request.setId(null);
        request.setPatientId(patientId);
        if (request.getStatus() == null || request.getStatus().isBlank()) {
            request.setStatus("ACTIVE");
        }
        if (request.getOrderingClinicianName() == null || request.getOrderingClinicianName().isBlank()) {
            request.setOrderingClinicianName(currentActorName());
        }
        request.setCreatedAt(now);
        request.setUpdatedAt(now);
        encryptClinicalOrder(request);
        PatientClinicalOrder saved = decryptClinicalOrder(clinicalOrderRepository.save(request));
        evictPatientHistory(patientId);
        return saved;
    }

    public PatientClinicalOrder updateClinicalOrder(String patientId, String id, PatientClinicalOrder request) {
        assertManageAccess(patientId);
        PatientClinicalOrder existing = findPatientOwnedClinicalOrder(patientId, id);
        if (request.getLinkedEpcrId() != null) {
            validateEpcrLink(patientId, request.getLinkedEpcrId());
            existing.setLinkedEpcrId(request.getLinkedEpcrId());
        }
        if (request.getOrderType() != null) existing.setOrderType(request.getOrderType());
        if (request.getOrderName() != null) existing.setOrderName(request.getOrderName());
        if (request.getStatus() != null) existing.setStatus(request.getStatus());
        if (request.getInstructions() != null) existing.setInstructions(request.getInstructions());
        if (request.getFrequency() != null) existing.setFrequency(request.getFrequency());
        if (request.getStartDate() != null) existing.setStartDate(request.getStartDate());
        if (request.getEndDate() != null) existing.setEndDate(request.getEndDate());
        if (request.getOrderingClinicianName() != null) existing.setOrderingClinicianName(request.getOrderingClinicianName());
        if (request.getNotes() != null) existing.setNotes(request.getNotes());
        existing.setUpdatedAt(LocalDateTime.now());
        encryptClinicalOrder(existing);
        PatientClinicalOrder saved = decryptClinicalOrder(clinicalOrderRepository.save(existing));
        evictPatientHistory(patientId);
        return saved;
    }

    public void deleteClinicalOrder(String patientId, String id) {
        assertManageAccess(patientId);
        findPatientOwnedClinicalOrder(patientId, id);
        clinicalOrderRepository.deleteById(id);
        evictPatientHistory(patientId);
    }

    private void encryptClinicalOrder(PatientClinicalOrder order) {
        if (order == null) return;
        order.setOrderName(phiCryptoService.encrypt(order.getOrderName()));
        order.setInstructions(phiCryptoService.encrypt(order.getInstructions()));
        order.setFrequency(phiCryptoService.encrypt(order.getFrequency()));
        order.setOrderingClinicianName(phiCryptoService.encrypt(order.getOrderingClinicianName()));
        order.setNotes(phiCryptoService.encrypt(order.getNotes()));
    }

    private PatientClinicalOrder decryptClinicalOrder(PatientClinicalOrder source) {
        if (source == null) return null;
        PatientClinicalOrder copy = new PatientClinicalOrder();
        copy.setId(source.getId());
        copy.setPatientId(source.getPatientId());
        copy.setLinkedEpcrId(source.getLinkedEpcrId());
        copy.setOrderType(source.getOrderType());
        copy.setOrderName(phiCryptoService.decrypt(source.getOrderName()));
        copy.setStatus(source.getStatus());
        copy.setInstructions(phiCryptoService.decrypt(source.getInstructions()));
        copy.setFrequency(phiCryptoService.decrypt(source.getFrequency()));
        copy.setStartDate(source.getStartDate());
        copy.setEndDate(source.getEndDate());
        copy.setOrderingClinicianName(phiCryptoService.decrypt(source.getOrderingClinicianName()));
        copy.setNotes(phiCryptoService.decrypt(source.getNotes()));
        copy.setCreatedAt(source.getCreatedAt());
        copy.setUpdatedAt(source.getUpdatedAt());
        return copy;
    }

    private List<PatientClinicalOrder> decryptClinicalOrders(List<PatientClinicalOrder> orders) {
        return orders == null ? List.of() : orders.stream().map(this::decryptClinicalOrder).collect(Collectors.toList());
    }
}
