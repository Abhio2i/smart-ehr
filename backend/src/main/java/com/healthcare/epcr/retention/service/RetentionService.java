package com.healthcare.epcr.retention.service;

import com.healthcare.epcr.auditlog.service.AuditLogService;
import com.healthcare.epcr.epcr.model.PatientCareRecord;
import com.healthcare.epcr.epcr.repository.PatientCareRecordRepository;
import com.healthcare.epcr.patient.model.Patient;
import com.healthcare.epcr.patient.repository.PatientRepository;
import com.healthcare.epcr.retention.enums.DispositionStatus;
import com.healthcare.epcr.retention.enums.RetentionStatus;
import com.healthcare.epcr.retention.model.*;
import com.healthcare.epcr.retention.repository.DispositionReviewRepository;
import com.healthcare.epcr.retention.repository.RetentionFolderRepository;
import com.healthcare.epcr.retention.repository.RetentionRuleRepository;
import com.healthcare.epcr.tb.model.TbCase;
import com.healthcare.epcr.tb.model.TbContact;
import com.healthcare.epcr.tb.model.TbTstTest;
import com.healthcare.epcr.tb.repository.TbCaseRepository;
import com.healthcare.epcr.reports.service.PatientAnalyticsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class RetentionService {

    private final RetentionRuleRepository ruleRepository;
    private final RetentionFolderRepository folderRepository;
    private final DispositionReviewRepository reviewRepository;

    private final TbCaseRepository tbCaseRepository;
    private final PatientCareRecordRepository epcrRepository;
    private final PatientRepository patientRepository;

    private final AuditLogService auditLogService;
    private final MongoTemplate mongoTemplate;
    private final PatientAnalyticsService patientAnalyticsService;

    // ── 1. Retention Rules ───────────────────────────────────────────────────

    public RetentionRule createRule(RetentionRule rule, String organizationId, String userId, String createdBy) {
        rule.setOrganizationId(organizationId);
        rule.setCreatedAt(Instant.now());
        rule.setCreatedBy(createdBy);
        RetentionRule saved = ruleRepository.save(rule);

        // Immutable compliance audit logging
        auditLogService.logAction(
                userId,
                "CREATE_RETENTION_RULE",
                "RetentionRule",
                saved.getId(),
                "Created retention rule: " + saved.getPolicyName() + " (" + saved.getRetentionPeriodYears() + " Years)"
        );

        return saved;
    }

    public List<RetentionRule> getRules(String organizationId) {
        return ruleRepository.findByOrganizationId(organizationId);
    }

    // ── 2. Retention Folders & Policy Inheritance ────────────────────────────

    public RetentionFolder createFolder(RetentionFolder folder, String organizationId, String userId, String createdBy) {
        folder.setOrganizationId(organizationId);
        folder.setCreatedAt(Instant.now());
        folder.setCreatedBy(createdBy);

        // Inherit policy from parent if not set explicitly
        if (folder.getRetentionRuleId() == null && folder.getParentFolderId() != null) {
            folderRepository.findById(folder.getParentFolderId())
                    .ifPresent(parent -> folder.setRetentionRuleId(parent.getRetentionRuleId()));
        }

        RetentionFolder saved = folderRepository.save(folder);

        // Immutable compliance audit logging
        auditLogService.logAction(
                userId,
                "CREATE_RETENTION_FOLDER",
                "RetentionFolder",
                saved.getId(),
                "Created folder: " + saved.getFolderName() + " (Inherited Rule: " + saved.getRetentionRuleId() + ")"
        );

        return saved;
    }

    public List<RetentionFolder> getFolders(String organizationId) {
        return folderRepository.findByOrganizationId(organizationId);
    }

    // ── 3. Legal Hold Management ─────────────────────────────────────────────

    public void setRecordHold(String recordType, String recordId, boolean hold, String reason, String organizationId, String userId) {
        String actionType = hold ? "APPLY_LEGAL_HOLD" : "RELEASE_LEGAL_HOLD";
        log.info("[Retention] Toggle hold actionType={} on type={} id={}", actionType, recordType, recordId);

        if ("TB_CASE".equalsIgnoreCase(recordType)) {
            TbCase tbCase = tbCaseRepository.findById(recordId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "TB Case not found"));
            if (!tbCase.getOrganizationId().equals(organizationId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN);
            }
            RetentionMetadata meta = tbCase.getRetentionMetadata();
            if (meta == null) meta = new RetentionMetadata();
            meta.setRetentionHold(hold);
            meta.setHoldReason(hold ? reason : null);
            meta.setStatus(hold ? RetentionStatus.RETENTION_HOLD : RetentionStatus.ACTIVE);
            tbCase.setRetentionMetadata(meta);
            tbCaseRepository.save(tbCase);

        } else if ("EPCR".equalsIgnoreCase(recordType)) {
            PatientCareRecord record = epcrRepository.findById(recordId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "ePCR not found"));
            if (!record.getOrganizationId().equals(organizationId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN);
            }
            RetentionMetadata meta = record.getRetentionMetadata();
            if (meta == null) meta = new RetentionMetadata();
            meta.setRetentionHold(hold);
            meta.setHoldReason(hold ? reason : null);
            meta.setStatus(hold ? RetentionStatus.RETENTION_HOLD : RetentionStatus.ACTIVE);
            record.setRetentionMetadata(meta);
            epcrRepository.save(record);

        } else if ("PATIENT".equalsIgnoreCase(recordType)) {
            Patient patient = patientRepository.findById(recordId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Patient not found"));
            if (!patient.getOrganizationId().equals(organizationId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN);
            }
            RetentionMetadata meta = patient.getRetentionMetadata();
            if (meta == null) meta = new RetentionMetadata();
            meta.setRetentionHold(hold);
            meta.setHoldReason(hold ? reason : null);
            meta.setStatus(hold ? RetentionStatus.RETENTION_HOLD : RetentionStatus.ACTIVE);
            patient.setRetentionMetadata(meta);
            patientRepository.save(patient);
        } else {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown record type: " + recordType);
        }

        // Immutable compliance audit logging
        auditLogService.logAction(
                userId,
                actionType,
                recordType,
                recordId,
                "Legal Hold Status set to: " + hold + ". Reason: " + reason
        );
    }

    // ── 4. Disposition Approvals ─────────────────────────────────────────────

    public List<DispositionReview> getPendingReviews(String organizationId) {
        return reviewRepository.findByOrganizationIdAndStatus(organizationId, DispositionStatus.PENDING_APPROVAL);
    }

    public DispositionReview actionDisposition(String reviewId, DispositionStatus status, String notes, String reviewerId, String reviewerName, String organizationId) {
        DispositionReview review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Review not found"));

        if (!review.getOrganizationId().equals(organizationId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }

        review.setStatus(status);
        review.setNotes(notes);
        review.setReviewedBy(reviewerId);
        review.setReviewedByName(reviewerName);
        review.setReviewedAt(Instant.now());

        String recordId = review.getRecordId();
        String recordType = review.getRecordType();

        if (status == DispositionStatus.APPROVED_DISPOSAL) {
            deletePhysicalRecord(recordType, recordId);
        } else if (status == DispositionStatus.APPROVED_ARCHIVE) {
            updateRecordRetentionStatus(recordType, recordId, RetentionStatus.ARCHIVED, null);
        } else if (status == DispositionStatus.EXTENDED) {
            LocalDate extendedDate = LocalDate.now().plusYears(5);
            updateRecordRetentionStatus(recordType, recordId, RetentionStatus.ACTIVE, extendedDate);
        }

        DispositionReview savedReview = reviewRepository.save(review);

        // Immutable compliance audit logging
        auditLogService.logAction(
                reviewerName,
                "AUTHORIZE_DISPOSITION",
                recordType,
                recordId,
                "Authorized disposition: " + status + ". Reviewer ID: " + reviewerId + ". Notes: " + notes
        );

        return savedReview;
    }

    // ── Private Helpers with Cascading Deletions ─────────────────────────────

    private void deletePhysicalRecord(String recordType, String recordId) {
        log.info("[Retention] Performing cascading disposal deletion on type={} id={}", recordType, recordId);

        if ("TB_CASE".equalsIgnoreCase(recordType)) {
            // Delete associated skin tests and exposure contacts first to prevent orphaned records (HIPAA compliance)
            mongoTemplate.remove(Query.query(Criteria.where("caseId").is(recordId)), TbTstTest.class);
            mongoTemplate.remove(Query.query(Criteria.where("indexCaseId").is(recordId)), TbContact.class);
            tbCaseRepository.deleteById(recordId);
            log.info("[Retention] Deleted TB Case {} and recursively purged contacts & TST logs.", recordId);

        } else if ("EPCR".equalsIgnoreCase(recordType)) {
            epcrRepository.deleteById(recordId);
            log.info("[Retention] Deleted ePCR record {}.", recordId);

        } else if ("PATIENT".equalsIgnoreCase(recordType)) {
            patientRepository.findById(recordId).ifPresent(patient -> {
                String patientId = patient.getPatientId();

                // 1. Delete associated emergency ePCRs
                mongoTemplate.remove(Query.query(Criteria.where("patientId").is(patientId)), PatientCareRecord.class);

                // 2. Find and delete TB Cases and their child contact/TST logs
                List<TbCase> tbCases = mongoTemplate.find(Query.query(Criteria.where("patientId").is(patientId)), TbCase.class);
                for (TbCase tbCase : tbCases) {
                    mongoTemplate.remove(Query.query(Criteria.where("caseId").is(tbCase.getId())), TbTstTest.class);
                    mongoTemplate.remove(Query.query(Criteria.where("indexCaseId").is(tbCase.getId())), TbContact.class);
                    tbCaseRepository.delete(tbCase);
                }

                // 3. Delete Patient record
                patientRepository.delete(patient);
                log.info("[Retention] Recursively purged Patient {} along with all linked ePCRs, TB Cases, Contacts, and TST logs.", recordId);
            });
        }
        patientAnalyticsService.clearCache(null);
    }

    private void updateRecordRetentionStatus(String recordType, String recordId, RetentionStatus nextStatus, LocalDate customExpiry) {
        if ("TB_CASE".equalsIgnoreCase(recordType)) {
            tbCaseRepository.findById(recordId).ifPresent(tbCase -> {
                RetentionMetadata meta = tbCase.getRetentionMetadata();
                if (meta == null) meta = new RetentionMetadata();
                meta.setStatus(nextStatus);
                if (customExpiry != null) meta.setCalculatedExpiryDate(customExpiry);
                tbCase.setRetentionMetadata(meta);
                tbCaseRepository.save(tbCase);
            });
        } else if ("EPCR".equalsIgnoreCase(recordType)) {
            epcrRepository.findById(recordId).ifPresent(record -> {
                RetentionMetadata meta = record.getRetentionMetadata();
                if (meta == null) meta = new RetentionMetadata();
                meta.setStatus(nextStatus);
                if (customExpiry != null) meta.setCalculatedExpiryDate(customExpiry);
                record.setRetentionMetadata(meta);
                epcrRepository.save(record);
            });
        } else if ("PATIENT".equalsIgnoreCase(recordType)) {
            patientRepository.findById(recordId).ifPresent(patient -> {
                RetentionMetadata meta = patient.getRetentionMetadata();
                if (meta == null) meta = new RetentionMetadata();
                meta.setStatus(nextStatus);
                if (customExpiry != null) meta.setCalculatedExpiryDate(customExpiry);
                patient.setRetentionMetadata(meta);
                patientRepository.save(patient);
            });
        }
    }
}
