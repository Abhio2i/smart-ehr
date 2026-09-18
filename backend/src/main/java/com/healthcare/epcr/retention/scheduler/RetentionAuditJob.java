package com.healthcare.epcr.retention.scheduler;

import com.healthcare.epcr.epcr.model.PatientCareRecord;
import com.healthcare.epcr.patient.model.Patient;
import com.healthcare.epcr.retention.enums.DispositionStatus;
import com.healthcare.epcr.retention.enums.RetentionStatus;
import com.healthcare.epcr.retention.model.DispositionReview;
import com.healthcare.epcr.retention.model.RetentionMetadata;
import com.healthcare.epcr.retention.repository.DispositionReviewRepository;
import com.healthcare.epcr.tb.model.TbCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class RetentionAuditJob {

    private final MongoTemplate mongoTemplate;
    private final DispositionReviewRepository reviewRepository;

    /**
     * Run daily at 1:00 AM to process retention expiries.
     */
    @Scheduled(cron = "0 0 1 * * ?")
    public void runRetentionAudit() {
        log.info("[Retention Audit] Starting daily lifecycle retention audit...");
        LocalDate today = LocalDate.now();

        // 1. Process Expired TB Cases
        Query tbQuery = Query.query(Criteria.where("retentionMetadata.calculatedExpiryDate").lt(today)
                .and("retentionMetadata.status").is(RetentionStatus.ACTIVE)
                .and("retentionMetadata.retentionHold").is(false));
        List<TbCase> expiredCases = mongoTemplate.find(tbQuery, TbCase.class);
        for (TbCase c : expiredCases) {
            expireCase(c);
        }

        // 2. Process Expired ePCR Records
        Query epcrQuery = Query.query(Criteria.where("retentionMetadata.calculatedExpiryDate").lt(today)
                .and("retentionMetadata.status").is(RetentionStatus.ACTIVE)
                .and("retentionMetadata.retentionHold").is(false));
        List<PatientCareRecord> expiredEpcr = mongoTemplate.find(epcrQuery, PatientCareRecord.class);
        for (PatientCareRecord r : expiredEpcr) {
            expireEpcr(r);
        }

        // 3. Process Expired Patients
        Query patientQuery = Query.query(Criteria.where("retentionMetadata.calculatedExpiryDate").lt(today)
                .and("retentionMetadata.status").is(RetentionStatus.ACTIVE)
                .and("retentionMetadata.retentionHold").is(false));
        List<Patient> expiredPatients = mongoTemplate.find(patientQuery, Patient.class);
        for (Patient p : expiredPatients) {
            expirePatient(p);
        }

        log.info("[Retention Audit] Completed daily lifecycle retention audit. TB Cases processed={}, ePCR processed={}, Patients processed={}",
                expiredCases.size(), expiredEpcr.size(), expiredPatients.size());
    }

    private void expireCase(TbCase c) {
        log.info("[Retention Audit] TB Case has expired: id={} caseNumber={}", c.getId(), c.getCaseNumber());
        RetentionMetadata meta = c.getRetentionMetadata();
        meta.setStatus(RetentionStatus.EXPIRED);
        c.setRetentionMetadata(meta);
        mongoTemplate.save(c);

        createDispositionReview(c.getId(), "TB_CASE", c.getPatientName() + " (" + c.getCaseNumber() + ")", meta.getCalculatedExpiryDate(), c.getOrganizationId());
    }

    private void expireEpcr(PatientCareRecord r) {
        log.info("[Retention Audit] ePCR has expired: id={} incidentNumber={}", r.getId(), r.getIncidentNumber());
        RetentionMetadata meta = r.getRetentionMetadata();
        meta.setStatus(RetentionStatus.EXPIRED);
        r.setRetentionMetadata(meta);
        mongoTemplate.save(r);

        createDispositionReview(r.getId(), "EPCR", "ePCR: " + r.getPatientName() + " (" + r.getIncidentNumber() + ")", meta.getCalculatedExpiryDate(), r.getOrganizationId());
    }

    private void expirePatient(Patient p) {
        log.info("[Retention Audit] Patient account has expired: id={} phone={}", p.getId(), p.getPhone());
        RetentionMetadata meta = p.getRetentionMetadata();
        meta.setStatus(RetentionStatus.EXPIRED);
        p.setRetentionMetadata(meta);
        mongoTemplate.save(p);

        createDispositionReview(p.getId(), "PATIENT", "Patient Account: " + p.getPhone(), meta.getCalculatedExpiryDate(), p.getOrganizationId());
    }

    private void createDispositionReview(String recordId, String recordType, String recordName, LocalDate expiryDate, String organizationId) {
        // Prevent duplicate queue entries
        if (reviewRepository.findByRecordId(recordId).isPresent()) {
            return;
        }

        DispositionReview review = new DispositionReview();
        review.setOrganizationId(organizationId);
        review.setRecordId(recordId);
        review.setRecordType(recordType);
        review.setRecordName(recordName);
        review.setExpiryDate(expiryDate);
        review.setStatus(DispositionStatus.PENDING_APPROVAL);
        review.setCreatedAt(Instant.now());
        reviewRepository.save(review);
    }
}
