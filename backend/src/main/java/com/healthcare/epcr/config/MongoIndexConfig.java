package com.healthcare.epcr.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import java.util.List;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import com.mongodb.MongoCommandException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.CompoundIndexDefinition;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.IndexOperations;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Component;
import com.healthcare.epcr.scheduling.model.AppointmentSlot;
import org.bson.Document;

/**
 * Ensures all required MongoDB indexes are created at startup.
 *
 * <p>In production, {@code spring.mongodb.auto-index-creation=false} to avoid
 * performance penalties on large collections. Instead, this component explicitly
 * creates indexes using {@link MongoTemplate} once the application is fully ready.
 *
 * <p>Index creation is idempotent — MongoDB silently ignores duplicates.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MongoIndexConfig {

    private final MongoTemplate mongoTemplate;

    @EventListener(ApplicationReadyEvent.class)
    public void ensureIndexes() {
        log.info("Ensuring MongoDB indexes...");
        ensureUserSessionIndexes();
        ensurePatientCareRecordIndexes();
        ensureQaReviewIndexes();
        ensureNotificationIndexes();
        ensureHealthCareCoverageIndexes();
        deduplicateSlots();
        ensureAppointmentSlotIndexes();
        ensureWaitlistIndexes();
        ensureTbIndexes();
        ensureRetentionIndexes();
        log.info("MongoDB index check complete.");
    }

    private void ensurePatientCareRecordIndexes() {
        IndexOperations ops = mongoTemplate.indexOps("patient_care_records");

        // Index on organizationId (ASC) + updatedAt (DESC) for fast paginated listing
        safeEnsureIndex(ops, new CompoundIndexDefinition(
                new org.bson.Document("organizationId", 1).append("updatedAt", -1))
                .named("idx_org_updatedAt"), "idx_org_updatedAt");

        // Dashboard counts and recent record lookups by paramedic/status.
        safeEnsureIndex(ops, new CompoundIndexDefinition(
                new org.bson.Document("paramedicsId", 1).append("status", 1))
                .named("idx_paramedics_status"), "idx_paramedics_status");

        safeEnsureIndex(ops, new CompoundIndexDefinition(
                new org.bson.Document("paramedicsId", 1).append("updatedAt", -1))
                .named("idx_paramedics_updatedAt"), "idx_paramedics_updatedAt");

        safeEnsureIndex(ops, new CompoundIndexDefinition(
                new org.bson.Document("organizationId", 1).append("status", 1))
                .named("idx_org_status"), "idx_org_status");

        // Index on status
        safeEnsureIndex(ops, new Index()
                .on("status", Sort.Direction.ASC)
                .named("idx_status"), "idx_status");

        // Index on incidentType
        safeEnsureIndex(ops, new Index()
                .on("incidentType", Sort.Direction.ASC)
                .named("idx_incidentType"), "idx_incidentType");

        // Index on incidentDateTime for range queries
        safeEnsureIndex(ops, new Index()
                .on("incidentDateTime", Sort.Direction.DESC)
                .named("idx_incidentDateTime"), "idx_incidentDateTime");

        log.info("patient_care_records indexes ensured.");
    }

    private void ensureQaReviewIndexes() {
        IndexOperations ops = mongoTemplate.indexOps("qa_reviews");

        safeEnsureIndex(ops, new CompoundIndexDefinition(
                new Document("patientCareRecordId", 1).append("status", 1))
                .named("idx_record_status"), "idx_record_status");

        safeEnsureIndex(ops, new Index()
                .on("status", Sort.Direction.ASC)
                .named("idx_qa_status"), "idx_qa_status");

        safeEnsureIndex(ops, new Index()
                .on("completedAt", Sort.Direction.DESC)
                .named("idx_qa_completedAt"), "idx_qa_completedAt");

        log.info("qa_reviews indexes ensured.");
    }

    private void ensureNotificationIndexes() {
        IndexOperations ops = mongoTemplate.indexOps("notifications");

        safeEnsureIndex(ops, new CompoundIndexDefinition(
                new Document("recipientId", 1).append("read", 1).append("createdAt", -1))
                .named("idx_recipient_read_createdAt"), "idx_recipient_read_createdAt");

        log.info("notifications indexes ensured.");
    }

    private void ensureUserSessionIndexes() {
        IndexOperations ops = mongoTemplate.indexOps("user_sessions");

        // Unique index on refreshTokenHash (already annotated, but ensuring it's idempotent)
        safeEnsureIndex(ops, new Index()
                .on("refreshTokenHash", Sort.Direction.ASC)
                .unique()
                .named("idx_refreshTokenHash_unique"), "idx_refreshTokenHash_unique");

        // Compound: userId + active — used by hasActiveSession() and findByUserIdAndActiveTrue()
        safeEnsureIndex(ops, new CompoundIndexDefinition(
                new Document("userId", 1).append("active", 1))
                .named("idx_userId_active"), "idx_userId_active");

        // Compound: active + revokedAt — used by cleanup scheduler
        safeEnsureIndex(ops, new CompoundIndexDefinition(
                new Document("active", 1).append("revokedAt", 1))
                .named("idx_active_revokedAt"), "idx_active_revokedAt");

        // Single: expiresAt — used by deleteByExpiresAtBefore() in cleanup scheduler
        safeEnsureIndex(ops, new Index()
                .on("expiresAt", Sort.Direction.ASC)
                .named("idx_expiresAt"), "idx_expiresAt");

        log.info("user_sessions indexes ensured.");
    }

    private void ensureHealthCareCoverageIndexes() {
        IndexOperations ops = mongoTemplate.indexOps("health_care_coverages");

        safeEnsureIndex(ops, new Index()
                .on("patientId", Sort.Direction.ASC)
                .unique()
                .named("idx_coverage_patientId"), "idx_coverage_patientId");

        safeEnsureIndex(ops, new Index()
                .on("organizationId", Sort.Direction.ASC)
                .named("idx_coverage_organizationId"), "idx_coverage_organizationId");

        log.info("health_care_coverages indexes ensured.");
    }

    private void ensureAppointmentSlotIndexes() {
        IndexOperations ops = mongoTemplate.indexOps("appointment_slots");

        safeEnsureIndex(ops, new CompoundIndexDefinition(
                new Document("providerId", 1).append("slotStart", 1))
                .unique()
                .named("provider_slot_unique"), "provider_slot_unique");

        log.info("appointment_slots indexes ensured.");
    }

    private void deduplicateSlots() {
        try {
            log.info("Deduplicating appointment slots...");
            List<Document> duplicates = mongoTemplate.getCollection("appointment_slots")
                .aggregate(List.of(
                    new Document("$group", new Document("_id", new Document("providerId", "$providerId").append("slotStart", "$slotStart"))
                        .append("count", new Document("$sum", 1))
                        .append("ids", new Document("$push", "$_id"))
                        .append("statuses", new Document("$push", "$status"))
                    ),
                    new Document("$match", new Document("count", new Document("$gt", 1)))
                )).into(new java.util.ArrayList<>());

            log.info("Found {} duplicate slot groups to clean.", duplicates.size());
            for (Document doc : duplicates) {
                List<?> ids = (List<?>) doc.get("ids");
                List<?> statuses = (List<?>) doc.get("statuses");
                if (ids == null || ids.size() <= 1) continue;

                // Determine which ID to keep: prefer BOOKED or BLOCKED over OPEN
                Object idToKeep = ids.get(0);
                for (int i = 0; i < ids.size(); i++) {
                    String status = String.valueOf(statuses.get(i));
                    if ("BOOKED".equals(status) || "BLOCKED".equals(status)) {
                        idToKeep = ids.get(i);
                        break;
                    }
                }

                // Delete all other IDs in this group
                for (Object id : ids) {
                    if (!id.equals(idToKeep)) {
                        mongoTemplate.remove(Query.query(Criteria.where("id").is(id)), AppointmentSlot.class);
                    }
                }
            }
            log.info("Appointment slots deduplication complete.");
        } catch (Exception e) {
            log.error("Failed to deduplicate slots: {}", e.getMessage());
        }
    }

    /**
     * Waitlist ESR compound index:
     *   { organizationId: 1, facilityId: 1, serviceType: 1, status: 1, priorityScore: -1, createdAt: 1 }
     * Equality: organizationId, facilityId, serviceType, status
     * Sort:     priorityScore DESC (higher priority first), createdAt ASC (FIFO tie-break)
     * This single index satisfies both the queue fetch AND the countDocuments position queries.
     */
    private void ensureWaitlistIndexes() {
        IndexOperations ops = mongoTemplate.indexOps("waitlist_entries");
        safeEnsureIndex(ops, new CompoundIndexDefinition(
                new org.bson.Document("organizationId", 1)
                        .append("facilityId", 1)
                        .append("serviceType", 1)
                        .append("status", 1)
                        .append("priorityScore", -1)
                        .append("createdAt", 1))
                .named("queue_lookup_esr"), "queue_lookup_esr");
        log.info("Waitlist indexes ensured.");
    }

    private void ensureTbIndexes() {
        // tb_cases: fast lookup by org + status + diagnosisDate
        IndexOperations caseOps = mongoTemplate.indexOps("tb_cases");
        safeEnsureIndex(caseOps, new CompoundIndexDefinition(
                new org.bson.Document("organizationId", 1).append("status", 1).append("diagnosisDate", -1))
                .named("idx_tb_cases_org_status_date"), "idx_tb_cases_org_status_date");

        safeEnsureIndex(caseOps, new Index("patientId", Sort.Direction.ASC)
                .named("idx_tb_cases_patientId"), "idx_tb_cases_patientId");

        safeEnsureIndex(caseOps, new Index("caseNumber", Sort.Direction.ASC)
                .unique().named("idx_tb_cases_caseNumber_unique"), "idx_tb_cases_caseNumber_unique");

        // tb_contacts: fast lookup by case + risk + investigation status
        IndexOperations contactOps = mongoTemplate.indexOps("tb_contacts");
        safeEnsureIndex(contactOps, new CompoundIndexDefinition(
                new org.bson.Document("indexCaseId", 1).append("riskLevel", 1).append("investigationStatus", 1))
                .named("idx_tb_contacts_case_risk_status"), "idx_tb_contacts_case_risk_status");

        safeEnsureIndex(contactOps, new Index("organizationId", Sort.Direction.ASC)
                .named("idx_tb_contacts_org"), "idx_tb_contacts_org");

        // tb_tst_tests: fast lookup by contact
        IndexOperations tstOps = mongoTemplate.indexOps("tb_tst_tests");
        safeEnsureIndex(tstOps, new CompoundIndexDefinition(
                new org.bson.Document("contactId", 1).append("plantDate", -1))
                .named("idx_tb_tst_contact_date"), "idx_tb_tst_contact_date");

        safeEnsureIndex(tstOps, new Index("caseId", Sort.Direction.ASC)
                .named("idx_tb_tst_caseId"), "idx_tb_tst_caseId");

        log.info("TB indexes ensured.");
    }

    private void ensureRetentionIndexes() {
        IndexOperations ruleOps = mongoTemplate.indexOps("retention_rules");
        safeEnsureIndex(ruleOps, new Index("organizationId", Sort.Direction.ASC)
                .named("idx_retention_rules_org"), "idx_retention_rules_org");

        IndexOperations folderOps = mongoTemplate.indexOps("retention_folders");
        safeEnsureIndex(folderOps, new CompoundIndexDefinition(
                new org.bson.Document("organizationId", 1).append("parentFolderId", 1))
                .named("idx_retention_folders_org_parent"), "idx_retention_folders_org_parent");

        IndexOperations reviewOps = mongoTemplate.indexOps("disposition_reviews");
        safeEnsureIndex(reviewOps, new CompoundIndexDefinition(
                new org.bson.Document("organizationId", 1).append("status", 1))
                .named("idx_disposition_reviews_org_status"), "idx_disposition_reviews_org_status");

        safeEnsureIndex(reviewOps, new Index("recordId", Sort.Direction.ASC)
                .unique().named("idx_disposition_reviews_recordId_unique"), "idx_disposition_reviews_recordId_unique");

        log.info("Retention indexes ensured.");
    }

    private void safeEnsureIndex(IndexOperations ops, Object indexDefinition, String indexName) {
        try {
            if (indexDefinition instanceof Index index) {
                ops.ensureIndex(index);
            } else if (indexDefinition instanceof CompoundIndexDefinition compound) {
                ops.ensureIndex(compound);
            } else {
                throw new IllegalArgumentException("Unsupported index definition type: " + indexDefinition.getClass());
            }
        } catch (DataIntegrityViolationException ex) {
            // Common on existing deployments where equivalent indexes exist under different names.
            log.warn("Skipping index '{}' due to existing conflicting index definition/name: {}", indexName, ex.getMessage());
        } catch (MongoCommandException ex) {
            // Error code 85 = IndexOptionsConflict: index already exists with a different name.
            // Safe to ignore — the underlying index still exists and serves the same purpose.
            log.warn("Skipping index '{}' — MongoDB error {}: {}", indexName, ex.getCode(), ex.getErrorMessage());
        } catch (Exception ex) {
            log.warn("Skipping index '{}' due to unexpected error: {}", indexName, ex.getMessage());
        }
    }
}
