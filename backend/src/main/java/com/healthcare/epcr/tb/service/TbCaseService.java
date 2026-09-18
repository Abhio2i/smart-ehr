package com.healthcare.epcr.tb.service;

import com.healthcare.epcr.tb.dto.*;
import com.healthcare.epcr.tb.enums.*;
import com.healthcare.epcr.tb.model.TbCase;
import com.healthcare.epcr.tb.model.TbContact;
import com.healthcare.epcr.tb.model.TbTstTest;
import com.healthcare.epcr.tb.repository.TbCaseRepository;
import com.healthcare.epcr.tb.repository.TbContactRepository;
import com.healthcare.epcr.tb.repository.TbTstTestRepository;
import com.healthcare.epcr.tb.repository.TbDotLogRepository;
import com.healthcare.epcr.tb.model.TbDotLog;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.Year;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class TbCaseService {

    private final TbCaseRepository caseRepository;
    private final TbContactRepository contactRepository;
    private final TbTstTestRepository tstTestRepository;
    private final TbDotLogRepository dotLogRepository;

    // ── 1. Create TB Case ────────────────────────────────────────────────────

    public TbCase createCase(CreateTbCaseRequest req, String organizationId, String createdBy) {
        TbCase tbCase = new TbCase();
        tbCase.setCaseNumber(generateCaseNumber(organizationId));
        tbCase.setOrganizationId(organizationId);
        tbCase.setPatientId(req.getPatientId());
        tbCase.setPatientName(req.getPatientName());
        tbCase.setPatientDob(req.getPatientDob());
        tbCase.setPatientPhone(req.getPatientPhone());
        tbCase.setPatientAddress(req.getPatientAddress());
        tbCase.setStatus(TbCaseStatus.SUSPECTED);
        tbCase.setClassification(req.getClassification());
        tbCase.setTbSite(req.getTbSite());
        tbCase.setSymptomStartDate(req.getSymptomStartDate());
        tbCase.setDiagnosisDate(req.getDiagnosisDate());
        tbCase.setNotificationDate(req.getNotificationDate());
        tbCase.setTreatmentStartDate(req.getTreatmentStartDate());
        tbCase.setRiskFactors(req.getRiskFactors());
        tbCase.setAssignedNurseId(req.getAssignedNurseId());
        tbCase.setAssignedNurseName(req.getAssignedNurseName());
        tbCase.setFacilityId(req.getFacilityId());
        tbCase.setNotes(req.getNotes());
        tbCase.setCreatedAt(Instant.now());
        tbCase.setUpdatedAt(Instant.now());
        tbCase.setCreatedBy(createdBy);

        TbCase saved = caseRepository.save(tbCase);
        log.info("[TB] New case created: id={} caseNumber={} patient={}", saved.getId(), saved.getCaseNumber(), saved.getPatientName());
        return saved;
    }

    // ── 2. List Cases ────────────────────────────────────────────────────────

    public Page<TbCase> listCases(String organizationId, TbCaseStatus status, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        if (status != null) {
            return caseRepository.findByOrganizationIdAndStatus(organizationId, status, pageable);
        }
        return caseRepository.findByOrganizationId(organizationId, pageable);
    }

    // ── 3. Get Case By ID ────────────────────────────────────────────────────

    public TbCase getCaseById(String id, String organizationId) {
        TbCase tbCase = caseRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "TB case not found: " + id));
        if (!tbCase.getOrganizationId().equals(organizationId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied to TB case: " + id);
        }
        return tbCase;
    }

    // ── 4. Update Case Status ────────────────────────────────────────────────

    public TbCase updateCaseStatus(String id, TbCaseStatus newStatus, String organizationId) {
        TbCase tbCase = getCaseById(id, organizationId);
        tbCase.setStatus(newStatus);
        tbCase.setUpdatedAt(Instant.now());
        TbCase saved = caseRepository.save(tbCase);
        log.info("[TB] Case status updated: id={} status={}", saved.getId(), newStatus);
        return saved;
    }

    // ── 5. Link Contact to Case ──────────────────────────────────────────────

    public TbContact linkContact(String caseId, LinkContactRequest req, String organizationId, String createdBy) {
        TbCase tbCase = getCaseById(caseId, organizationId);

        TbContact contact = new TbContact();
        contact.setIndexCaseId(tbCase.getId());
        contact.setOrganizationId(organizationId);
        contact.setContactPatientId(req.getContactPatientId());
        contact.setContactName(req.getContactName());
        contact.setContactPhone(req.getContactPhone());
        contact.setContactEmail(req.getContactEmail());
        contact.setContactAddress(req.getContactAddress());
        contact.setDateOfBirth(req.getDateOfBirth());
        contact.setGender(req.getGender());
        contact.setRiskLevel(req.getRiskLevel());
        contact.setExposureType(req.getExposureType());
        contact.setExposureStartDate(req.getExposureStartDate());
        contact.setExposureEndDate(req.getExposureEndDate());
        contact.setAvgExposureHoursPerDay(req.getAvgExposureHoursPerDay());
        contact.setInvestigationStatus(ContactInvestigationStatus.IDENTIFIED);
        contact.setAssignedNurseId(req.getAssignedNurseId());
        contact.setAssignedNurseName(req.getAssignedNurseName());
        contact.setNotes(req.getNotes());
        contact.setCreatedAt(Instant.now());
        contact.setUpdatedAt(Instant.now());
        contact.setCreatedBy(createdBy);

        TbContact saved = contactRepository.save(contact);
        log.info("[TB] Contact linked: id={} case={} contact={}", saved.getId(), caseId, req.getContactName());
        return saved;
    }

    // ── 6. List Contacts For Case ────────────────────────────────────────────

    public List<TbContact> getContactsForCase(String caseId, String organizationId) {
        getCaseById(caseId, organizationId); // validate access
        return contactRepository.findByIndexCaseId(caseId);
    }

    // ── 7. Update Contact Investigation Status ───────────────────────────────

    public TbContact updateContactStatus(String contactId, ContactInvestigationStatus newStatus, String organizationId) {
        TbContact contact = contactRepository.findById(contactId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contact not found: " + contactId));
        if (!contact.getOrganizationId().equals(organizationId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied to contact: " + contactId);
        }
        contact.setInvestigationStatus(newStatus);
        contact.setUpdatedAt(Instant.now());
        TbContact saved = contactRepository.save(contact);
        log.info("[TB] Contact status updated: id={} status={}", saved.getId(), newStatus);
        return saved;
    }

    // ── 8. Add TST Test ──────────────────────────────────────────────────────

    public TbTstTest addTstTest(String contactId, AddTstTestRequest req, String organizationId, String createdBy) {
        TbContact contact = contactRepository.findById(contactId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contact not found: " + contactId));
        if (!contact.getOrganizationId().equals(organizationId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied to contact: " + contactId);
        }

        TbTstTest test = new TbTstTest();
        test.setContactId(contactId);
        test.setCaseId(contact.getIndexCaseId());
        test.setOrganizationId(organizationId);
        test.setTestType(req.getTestType());
        test.setPlantDate(req.getPlantDate());
        test.setPlantedBy(req.getPlantedBy());
        test.setPlantArm(req.getPlantArm());
        test.setPlantBatchNumber(req.getPlantBatchNumber());
        test.setReadDate(req.getReadDate());
        test.setReadBy(req.getReadBy());
        test.setIndurationMm(req.getIndurationMm());
        test.setResult(req.getResult() != null ? TstResult.valueOf(req.getResult()) : TstResult.PENDING_READ);
        test.setClinicianInterpretation(req.getClinicianInterpretation());
        test.setChestXrayDate(req.getChestXrayDate());
        test.setChestXrayResult(req.getChestXrayResult());
        test.setChestXrayFindings(req.getChestXrayFindings());
        test.setNotes(req.getNotes());
        test.setCreatedAt(Instant.now());
        test.setUpdatedAt(Instant.now());
        test.setCreatedBy(createdBy);

        TbTstTest saved = tstTestRepository.save(test);
        log.info("[TB] TST test added: id={} contact={} result={}", saved.getId(), contactId, saved.getResult());
        return saved;
    }

    // ── 9. Get TST Tests For Contact ─────────────────────────────────────────

    public List<TbTstTest> getTstTestsForContact(String contactId, String organizationId) {
        contactRepository.findById(contactId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contact not found: " + contactId));
        return tstTestRepository.findByContactIdOrderByPlantDateDesc(contactId);
    }

    // ── 10. Stats ────────────────────────────────────────────────────────────

    public TbStatsDTO getStats(String organizationId) {
        return TbStatsDTO.builder()
                .totalCases(caseRepository.countByOrganizationId(organizationId))
                .activeTreatmentCases(caseRepository.countByOrganizationIdAndStatus(organizationId, TbCaseStatus.ACTIVE_TREATMENT))
                .suspectedCases(caseRepository.countByOrganizationIdAndStatus(organizationId, TbCaseStatus.SUSPECTED))
                .confirmedCases(caseRepository.countByOrganizationIdAndStatus(organizationId, TbCaseStatus.CONFIRMED))
                .completedCases(caseRepository.countByOrganizationIdAndStatus(organizationId, TbCaseStatus.TREATMENT_COMPLETED))
                .totalContacts(contactRepository.countByOrganizationIdAndRiskLevel(organizationId, ContactRiskLevel.HIGH)
                        + contactRepository.countByOrganizationIdAndRiskLevel(organizationId, ContactRiskLevel.MEDIUM)
                        + contactRepository.countByOrganizationIdAndRiskLevel(organizationId, ContactRiskLevel.LOW))
                .highRiskContacts(contactRepository.countByOrganizationIdAndRiskLevel(organizationId, ContactRiskLevel.HIGH))
                .mediumRiskContacts(contactRepository.countByOrganizationIdAndRiskLevel(organizationId, ContactRiskLevel.MEDIUM))
                .pendingEvaluationContacts(contactRepository.countByOrganizationIdAndInvestigationStatus(organizationId, ContactInvestigationStatus.EVALUATION_PENDING))
                .completedContactInvestigations(contactRepository.countByOrganizationIdAndInvestigationStatus(organizationId, ContactInvestigationStatus.COMPLETED))
                .build();
    }

    // ── 11. Directly Observed Therapy (DOT) Logs ─────────────────────────────

    public TbDotLog saveDotLog(String caseId, LocalDate logDate, DotStatus status, String notes, String organizationId, String nurseId, String nurseName) {
        getCaseById(caseId, organizationId); // validate case access

        // Upsert daily log
        TbDotLog logEntry = dotLogRepository.findByCaseIdAndLogDate(caseId, logDate)
                .orElse(new TbDotLog());

        logEntry.setCaseId(caseId);
        logEntry.setOrganizationId(organizationId);
        logEntry.setLogDate(logDate);
        logEntry.setStatus(status);
        logEntry.setRecordedBy(nurseId);
        logEntry.setRecordedByName(nurseName);
        logEntry.setNotes(notes);
        logEntry.setCreatedAt(Instant.now());

        return dotLogRepository.save(logEntry);
    }

    public List<TbDotLog> getDotLogs(String caseId, LocalDate start, LocalDate end, String organizationId) {
        getCaseById(caseId, organizationId); // validate access
        if (start != null && end != null) {
            return dotLogRepository.findByCaseIdAndLogDateBetween(caseId, start, end);
        }
        return dotLogRepository.findByCaseId(caseId);
    }

    // ── 12. Sputum Clearance Updates ─────────────────────────────────────────

    public TbCase updateSputumChecklist(String id, String sampleIndex, String result, LocalDate dateCollected, String organizationId) {
        TbCase tbCase = getCaseById(id, organizationId);

        if ("1".equals(sampleIndex)) {
            tbCase.setSputumSample1Result(result);
            tbCase.setSputumSample1Date(dateCollected);
        } else if ("2".equals(sampleIndex)) {
            tbCase.setSputumSample2Result(result);
            tbCase.setSputumSample2Date(dateCollected);
        } else if ("3".equals(sampleIndex)) {
            tbCase.setSputumSample3Result(result);
            tbCase.setSputumSample3Date(dateCollected);
        } else {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid sputum sample index: " + sampleIndex);
        }

        // If all 3 samples are NEGATIVE, we can suggest closing or completed
        if ("NEGATIVE".equals(tbCase.getSputumSample1Result()) &&
            "NEGATIVE".equals(tbCase.getSputumSample2Result()) &&
            "NEGATIVE".equals(tbCase.getSputumSample3Result())) {
            log.info("[TB] All 3 sputum clearance samples are NEGATIVE for caseId={}. Complete clearance achieved.", id);
        }

        tbCase.setUpdatedAt(Instant.now());
        return caseRepository.save(tbCase);
    }

    // ── Private Helpers ──────────────────────────────────────────────────────

    private String generateCaseNumber(String organizationId) {
        int year = Year.now().getValue();
        long count = caseRepository.countByOrganizationId(organizationId) + 1;
        return String.format("TB-%d-%05d", year, count);
    }
}
