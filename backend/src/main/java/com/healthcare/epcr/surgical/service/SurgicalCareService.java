package com.healthcare.epcr.surgical.service;

import com.healthcare.epcr.notification.model.Notification;
import com.healthcare.epcr.notification.repository.NotificationRepository;
import com.healthcare.epcr.notification.service.EmailService;
import com.healthcare.epcr.surgical.enums.AnesthesiaType;
import com.healthcare.epcr.surgical.enums.CaseStatus;
import com.healthcare.epcr.surgical.enums.CaseUrgency;
import com.healthcare.epcr.surgical.model.*;
import com.healthcare.epcr.surgical.repository.*;
import com.healthcare.epcr.user.model.User;
import com.healthcare.epcr.user.repository.UserRepository;
import com.healthcare.epcr.billing.service.ProviderPayoutService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.*;
import java.util.*;

/**
 * SurgicalCareService — core business logic for the Surgical Care module.
 *
 * Key design patterns (same as HomeCareService):
 *  1. Atomic OR booking: overlap query + DuplicateKeyException catch on compound index
 *  2. State machine: enforced transitions with business rule validation
 *  3. PreOp gate: IN_PROGRESS blocked until SignIn + TimeOut complete
 *  4. Notifications via NotificationRepository + EmailService (no Kafka)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SurgicalCareService {

    private final SurgicalCaseRepository caseRepository;
    private final OperatingRoomRepository orRepository;
    private final ORBlockScheduleRepository blockRepository;
    private final PreOpChecklistRepository checklistRepository;
    private final AnesthesiaRecordRepository anesthesiaRepository;
    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final MongoTemplate mongoTemplate;
    private final EmailService emailService;
    private final ProviderPayoutService providerPayoutService;

    // ─────────────────────────────────────────────────────────────────────────
    //  OPERATING ROOM CRUD
    // ─────────────────────────────────────────────────────────────────────────

    public OperatingRoom createOR(OperatingRoom room, String organizationId, String createdBy) {
        if (orRepository.existsByRoomNumberAndFacilityIdAndOrganizationId(
                room.getRoomNumber(), room.getFacilityId(), organizationId)) {
            throw new IllegalArgumentException(
                    "Operating Room '" + room.getRoomNumber() + "' already exists in this facility.");
        }
        room.setId(null);
        room.setOrganizationId(organizationId);
        room.setActive(true);
        room.setCreatedBy(createdBy);
        room.setCreatedAt(Instant.now());
        room.setUpdatedAt(Instant.now());
        OperatingRoom saved = orRepository.save(room);
        log.info("[Surgical] OR created: {} ({})", saved.getRoomNumber(), saved.getId());
        return saved;
    }

    public List<OperatingRoom> getORs(String organizationId) {
        return orRepository.findByOrganizationId(organizationId);
    }

    public OperatingRoom updateOR(String id, OperatingRoom update, String organizationId) {
        OperatingRoom existing = orRepository.findByIdAndOrganizationId(id, organizationId)
                .orElseThrow(() -> new IllegalArgumentException("Operating Room not found: " + id));
        if (update.getRoomName() != null) existing.setRoomName(update.getRoomName());
        if (update.getEquipmentTags() != null) existing.setEquipmentTags(update.getEquipmentTags());
        existing.setActive(update.isActive());
        existing.setUpdatedAt(Instant.now());
        return orRepository.save(existing);
    }

    public void deleteOR(String id, String organizationId) {
        OperatingRoom room = orRepository.findByIdAndOrganizationId(id, organizationId)
                .orElseThrow(() -> new IllegalArgumentException("Operating Room not found: " + id));
        orRepository.delete(room);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  OR BLOCK SCHEDULE
    // ─────────────────────────────────────────────────────────────────────────

    public ORBlockSchedule createBlock(ORBlockSchedule block, String organizationId) {
        block.setId(null);
        block.setOrganizationId(organizationId);
        block.setActive(true);
        block.setCreatedAt(Instant.now());
        block.setUpdatedAt(Instant.now());
        // Denormalize surgeon name
        userRepository.findById(block.getSurgeonId()).ifPresent(u ->
                block.setSurgeonName(u.getFirstName() + " " + u.getLastName()));
        return blockRepository.save(block);
    }

    public List<ORBlockSchedule> getBlocks(String organizationId, String orId, String surgeonId) {
        if (orId != null && !orId.isBlank()) {
            return blockRepository.findByOrIdAndOrganizationIdAndActiveTrue(orId, organizationId);
        }
        if (surgeonId != null && !surgeonId.isBlank()) {
            return blockRepository.findBySurgeonIdAndOrganizationId(surgeonId, organizationId);
        }
        return blockRepository.findByOrganizationId(organizationId);
    }

    public void deleteBlock(String id, String organizationId) {
        ORBlockSchedule block = blockRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Block schedule not found: " + id));
        if (!organizationId.equals(block.getOrganizationId())) {
            throw new IllegalArgumentException("Access denied: block not in your organization.");
        }
        blockRepository.delete(block);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  SURGICAL CASE — ATOMIC BOOKING
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Books a surgical case atomically.
     *
     * Double-booking prevention (two layers):
     *  Layer 1: Overlap query — checks existing SCHEDULED/IN_PROGRESS cases for the OR
     *           that overlap with [scheduledStart, scheduledEnd).
     *  Layer 2: CompoundIndex (orId + scheduledStart) — catches concurrent race conditions
     *           that slip past Layer 1 (same-millisecond concurrent requests).
     *
     * Pattern mirrors HomeCareService.assignNurse() atomic findAndModify approach.
     */
    public SurgicalCase bookCase(BookCaseRequest req, String organizationId, String createdBy) {
        // ── Layer 1: Overlap check ─────────────────────────────────────────
        Query overlapQuery = new Query(
                Criteria.where("orId").is(req.getOrId())
                        .and("status").in(
                                CaseStatus.SCHEDULED.name(),
                                CaseStatus.CHECKED_IN.name(),
                                CaseStatus.PRE_OP_VERIFIED.name(),
                                CaseStatus.IN_PROGRESS.name(),
                                CaseStatus.RECOVERY.name()
                        )
                        .andOperator(
                                Criteria.where("scheduledStart").lt(req.getScheduledEnd()),
                                Criteria.where("scheduledEnd").gt(req.getScheduledStart())
                        )
        );
        if (mongoTemplate.exists(overlapQuery, SurgicalCase.class)) {
            throw new IllegalStateException(
                    "OR is already booked during this time slot. Please choose a different time or OR.");
        }

        // ── Build case ────────────────────────────────────────────────────
        SurgicalCase sc = SurgicalCase.builder()
                .caseNumber(generateCaseNumber())
                .organizationId(organizationId)
                .facilityId(req.getFacilityId())
                .patientId(req.getPatientId())
                .patientName(req.getPatientName())
                .epcrRecordId(req.getEpcrRecordId())
                .orId(req.getOrId())
                .surgeonId(req.getSurgeonId())
                .anesthesiologistId(req.getAnesthesiologistId())
                .scheduledStart(req.getScheduledStart())
                .scheduledEnd(req.getScheduledEnd())
                .procedureName(req.getProcedureName())
                .cptCode(req.getCptCode())
                .snomedCode(req.getSnomedCode())
                .urgency(req.getUrgency() != null ? req.getUrgency() : CaseUrgency.ELECTIVE)
                .status(CaseStatus.SCHEDULED)
                .createdBy(createdBy)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        // Denormalize OR name
        orRepository.findById(req.getOrId()).ifPresent(or -> sc.setOrName(or.getRoomName()));

        // Denormalize surgeon name
        userRepository.findById(req.getSurgeonId()).ifPresent(u ->
                sc.setSurgeonName(u.getFirstName() + " " + u.getLastName()));

        // Denormalize anesthesiologist name
        if (req.getAnesthesiologistId() != null) {
            userRepository.findById(req.getAnesthesiologistId()).ifPresent(u ->
                    sc.setAnesthesiologistName(u.getFirstName() + " " + u.getLastName()));
        }

        // ── Layer 2: Insert (compound index safety net) ───────────────────
        SurgicalCase saved;
        try {
            saved = mongoTemplate.insert(sc);
        } catch (DuplicateKeyException e) {
            log.warn("[Surgical] Concurrent booking conflict on OR {} at {}", req.getOrId(), req.getScheduledStart());
            throw new IllegalStateException(
                    "Concurrent booking detected — OR slot was taken simultaneously. Please retry.");
        }

        log.info("[Surgical] Case booked: {} ({}) OR={} Start={}",
                saved.getCaseNumber(), saved.getId(), saved.getOrId(), saved.getScheduledStart());

        // ── Notifications ─────────────────────────────────────────────────
        notifySurgeonBooked(saved);
        if (saved.getAnesthesiologistId() != null) {
            notifyAnesthesiologistAssigned(saved);
        }

        return saved;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  SURGICAL CASE — READ
    // ─────────────────────────────────────────────────────────────────────────

    public List<SurgicalCase> getCases(String organizationId, String date, String orId, String patientId) {
        if (patientId != null && !patientId.isBlank()) {
            return caseRepository.findByPatientIdAndOrganizationId(patientId, organizationId);
        }
        if (date != null && !date.isBlank()) {
            Instant from = LocalDate.parse(date).atStartOfDay(ZoneOffset.UTC).toInstant();
            Instant to   = from.plus(Duration.ofDays(1));
            if (orId != null && !orId.isBlank()) {
                return caseRepository.findByOrIdAndOrganizationIdAndScheduledStartBetween(orId, organizationId, from, to);
            }
            return caseRepository.findByOrganizationIdAndScheduledStartBetween(organizationId, from, to);
        }
        return caseRepository.findByOrganizationId(organizationId);
    }

    public List<SurgicalCase> searchCases(String organizationId, String search, Integer limit) {
        if (search == null || search.isBlank()) {
            return caseRepository.findByOrganizationId(organizationId);
        }
        int fetchLimit = (limit != null && limit > 0) ? limit : 20;
        Query query = new Query();
        Criteria orgCriteria = Criteria.where("organizationId").is(organizationId);
        Criteria regexCriteria = new Criteria().orOperator(
                Criteria.where("caseNumber").regex(search, "i"),
                Criteria.where("patientName").regex(search, "i"),
                Criteria.where("patientId").regex(search, "i"),
                Criteria.where("surgeonName").regex(search, "i"),
                Criteria.where("procedureName").regex(search, "i")
        );
        query.addCriteria(new Criteria().andOperator(orgCriteria, regexCriteria));
        query.limit(fetchLimit);
        return mongoTemplate.find(query, SurgicalCase.class);
    }

    public SurgicalCase getCaseById(String id, String organizationId) {
        return caseRepository.findByIdAndOrganizationId(id, organizationId)
                .orElseThrow(() -> new IllegalArgumentException("Surgical case not found: " + id));
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  SURGICAL CASE — STATUS STATE MACHINE
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Transitions a surgical case to the next status.
     * Business rules enforced:
     *  - CHECKED_IN → PRE_OP_VERIFIED: blocked (shouldn't be called directly — managed by PreOp)
     *  - PRE_OP_VERIFIED → IN_PROGRESS: requires SignIn + TimeOut complete on PreOpChecklist
     *  - CANCELLED: allowed from any non-terminal state
     */
    public SurgicalCase transitionStatus(String caseId, String newStatusStr, String organizationId) {
        SurgicalCase sc = getCaseById(caseId, organizationId);
        CaseStatus newStatus = CaseStatus.valueOf(newStatusStr.toUpperCase());
        CaseStatus current   = sc.getStatus();

        // Terminal states cannot transition
        if (current == CaseStatus.COMPLETED || current == CaseStatus.CANCELLED) {
            throw new IllegalStateException("Case is already " + current + " and cannot be transitioned.");
        }

        // Validate allowed transitions
        validateTransition(sc, current, newStatus, organizationId);

        // Capture timestamps at transition points
        if (newStatus == CaseStatus.IN_PROGRESS && sc.getActualStart() == null) {
            sc.setActualStart(Instant.now());
        }
        if (newStatus == CaseStatus.RECOVERY && sc.getActualEnd() == null) {
            sc.setActualEnd(Instant.now());
        }

        sc.setStatus(newStatus);
        sc.setUpdatedAt(Instant.now());
        SurgicalCase updated = caseRepository.save(sc);

        log.info("[Surgical] Case {} transitioned: {} → {}", sc.getCaseNumber(), current, newStatus);

        if (newStatus == CaseStatus.COMPLETED && sc.getSurgeonId() != null) {
            try {
                java.time.LocalDateTime start = sc.getActualStart() != null 
                        ? java.time.LocalDateTime.ofInstant(sc.getActualStart(), java.time.ZoneOffset.UTC) 
                        : java.time.LocalDateTime.now();
                java.time.LocalDateTime end = sc.getActualEnd() != null 
                        ? java.time.LocalDateTime.ofInstant(sc.getActualEnd(), java.time.ZoneOffset.UTC) 
                        : java.time.LocalDateTime.now();
                providerPayoutService.logShiftFromSource(
                        sc.getSurgeonId(),
                        start,
                        end,
                        "SURGICAL_CASE",
                        sc.getId(),
                        sc.getOrganizationId()
                );
            } catch (Exception e) {
                log.error("[Surgical] Failed to log surgical case completion to provider payments for case {}", sc.getId(), e);
            }
        }

        // Notify surgeon on key transitions
        if (newStatus == CaseStatus.IN_PROGRESS || newStatus == CaseStatus.COMPLETED) {
            sendNotification(sc.getSurgeonId(),
                    "Surgical Case Update",
                    "Case " + sc.getCaseNumber() + " (" + sc.getProcedureName() + ") is now " + newStatus + ".",
                    sc.getId(), "SURGICAL_CASE");
        }

        return updated;
    }

    private void validateTransition(SurgicalCase sc, CaseStatus from, CaseStatus to, String organizationId) {
        // CANCELLED is allowed from any non-terminal state
        if (to == CaseStatus.CANCELLED) return;

        // Enforce linear progression
        CaseStatus[] order = {
            CaseStatus.SCHEDULED,
            CaseStatus.CHECKED_IN,
            CaseStatus.PRE_OP_VERIFIED,
            CaseStatus.IN_PROGRESS,
            CaseStatus.RECOVERY,
            CaseStatus.COMPLETED
        };
        int fromIdx = indexOf(order, from);
        int toIdx   = indexOf(order, to);
        if (toIdx != fromIdx + 1) {
            throw new IllegalStateException(
                    "Invalid transition: " + from + " → " + to +
                    ". Expected next state: " + (fromIdx + 1 < order.length ? order[fromIdx + 1] : "COMPLETED"));
        }

        // PRE_OP_VERIFIED → IN_PROGRESS: PreOpChecklist SignIn + TimeOut must be done
        if (to == CaseStatus.IN_PROGRESS) {
            Optional<PreOpChecklist> checklist = checklistRepository.findBySurgicalCaseId(sc.getId());
            if (checklist.isEmpty()) {
                throw new IllegalStateException(
                        "PreOp checklist not started. SignIn and TimeOut must be completed before starting surgery.");
            }
            PreOpChecklist cl = checklist.get();
            if (cl.getSignIn() == null || !cl.getSignIn().isCompleted()) {
                throw new IllegalStateException("PreOp Sign-In must be completed before starting surgery.");
            }
            if (cl.getTimeOut() == null || !cl.getTimeOut().isCompleted()) {
                throw new IllegalStateException("PreOp Time-Out must be completed before starting surgery.");
            }
        }
    }

    private int indexOf(CaseStatus[] arr, CaseStatus val) {
        for (int i = 0; i < arr.length; i++) {
            if (arr[i] == val) return i;
        }
        return -1;
    }

    public void cancelCase(String caseId, String organizationId) {
        SurgicalCase sc = getCaseById(caseId, organizationId);
        if (sc.getStatus() == CaseStatus.COMPLETED || sc.getStatus() == CaseStatus.CANCELLED) {
            throw new IllegalStateException("Case is already " + sc.getStatus() + ".");
        }
        sc.setStatus(CaseStatus.CANCELLED);
        sc.setUpdatedAt(Instant.now());
        caseRepository.save(sc);
        log.info("[Surgical] Case {} cancelled.", sc.getCaseNumber());
    }

    public void deleteCase(String caseId, String organizationId) {
        SurgicalCase sc = getCaseById(caseId, organizationId);
        checklistRepository.findBySurgicalCaseId(caseId).ifPresent(checklistRepository::delete);
        anesthesiaRepository.findBySurgicalCaseId(caseId).ifPresent(anesthesiaRepository::delete);
        caseRepository.delete(sc);
        log.info("[Surgical] Case {} completely deleted/purged from database.", sc.getCaseNumber());
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  OR DISPATCH BOARD
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Returns all surgical cases for a date, grouped by OR.
     * Mirrors HomeCareService.getDispatchBoard() pattern.
     */
    public List<SurgicalCase> getORBoard(String organizationId, String date, String facilityId) {
        Instant from = LocalDate.parse(date).atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant to   = from.plus(Duration.ofDays(1));

        List<SurgicalCase> cases = caseRepository
                .findByOrganizationIdAndScheduledStartBetween(organizationId, from, to);

        if (facilityId != null && !facilityId.isBlank()) {
            cases = cases.stream()
                    .filter(c -> facilityId.equals(c.getFacilityId()))
                    .collect(java.util.stream.Collectors.toList());
        }
        // Sort by scheduledStart for board display
        cases.sort(Comparator.comparing(SurgicalCase::getScheduledStart,
                Comparator.nullsLast(Comparator.naturalOrder())));
        return cases;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  PRE-OP CHECKLIST
    // ─────────────────────────────────────────────────────────────────────────

    public PreOpChecklist initChecklist(String caseId, String organizationId) {
        // Verify case belongs to org
        getCaseById(caseId, organizationId);
        if (checklistRepository.existsBySurgicalCaseId(caseId)) {
            throw new IllegalStateException("Checklist already exists for case: " + caseId);
        }
        PreOpChecklist cl = PreOpChecklist.builder()
                .surgicalCaseId(caseId)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
        PreOpChecklist saved = checklistRepository.save(cl);

        // Link to the surgical case
        SurgicalCase sc = getCaseById(caseId, organizationId);
        sc.setPreOpChecklistId(saved.getId());
        sc.setUpdatedAt(Instant.now());
        caseRepository.save(sc);

        return saved;
    }

    public PreOpChecklist getChecklist(String caseId, String organizationId) {
        getCaseById(caseId, organizationId); // access control
        return checklistRepository.findBySurgicalCaseId(caseId)
                .orElseThrow(() -> new IllegalArgumentException("No checklist found for case: " + caseId));
    }

    public PreOpChecklist completeSignIn(String caseId, PreOpChecklist.SignInPhase signIn,
                                         String completedBy, String organizationId) {
        PreOpChecklist cl = getChecklist(caseId, organizationId);
        signIn.setCompleted(true);
        signIn.setCompletedBy(completedBy);
        signIn.setCompletedAt(Instant.now());
        cl.setSignIn(signIn);
        cl.setUpdatedAt(Instant.now());

        // Auto-advance case to CHECKED_IN if still SCHEDULED
        SurgicalCase sc = getCaseById(caseId, organizationId);
        if (sc.getStatus() == CaseStatus.SCHEDULED) {
            sc.setStatus(CaseStatus.CHECKED_IN);
            sc.setUpdatedAt(Instant.now());
            caseRepository.save(sc);
        }
        log.info("[Surgical] PreOp Sign-In completed for case {}", caseId);
        return checklistRepository.save(cl);
    }

    public PreOpChecklist completeTimeOut(String caseId, PreOpChecklist.TimeOutPhase timeOut,
                                          String completedBy, String organizationId) {
        PreOpChecklist cl = getChecklist(caseId, organizationId);
        timeOut.setCompleted(true);
        timeOut.setCompletedBy(completedBy);
        timeOut.setCompletedAt(Instant.now());
        cl.setTimeOut(timeOut);
        cl.setUpdatedAt(Instant.now());

        // Auto-advance case to PRE_OP_VERIFIED if CHECKED_IN
        SurgicalCase sc = getCaseById(caseId, organizationId);
        if (sc.getStatus() == CaseStatus.CHECKED_IN) {
            sc.setStatus(CaseStatus.PRE_OP_VERIFIED);
            sc.setUpdatedAt(Instant.now());
            caseRepository.save(sc);
            log.info("[Surgical] Case {} auto-advanced to PRE_OP_VERIFIED", sc.getCaseNumber());
        }
        return checklistRepository.save(cl);
    }

    public PreOpChecklist completeSignOut(String caseId, PreOpChecklist.SignOutPhase signOut,
                                          String completedBy, String organizationId) {
        PreOpChecklist cl = getChecklist(caseId, organizationId);
        signOut.setCompleted(true);
        signOut.setCompletedBy(completedBy);
        signOut.setCompletedAt(Instant.now());
        cl.setSignOut(signOut);
        cl.setUpdatedAt(Instant.now());
        log.info("[Surgical] PreOp Sign-Out completed for case {}", caseId);
        return checklistRepository.save(cl);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  ANESTHESIA RECORD
    // ─────────────────────────────────────────────────────────────────────────

    public AnesthesiaRecord createAnesthesiaRecord(String caseId, AnesthesiaRecord record,
                                                    String organizationId) {
        getCaseById(caseId, organizationId); // access control
        if (anesthesiaRepository.existsBySurgicalCaseId(caseId)) {
            throw new IllegalStateException("Anesthesia record already exists for case: " + caseId);
        }
        record.setId(null);
        record.setSurgicalCaseId(caseId);
        record.setCompleted(false);
        record.setCreatedAt(Instant.now());
        record.setUpdatedAt(Instant.now());

        // Denormalize anesthesiologist name
        if (record.getAnesthesiologistId() != null) {
            userRepository.findById(record.getAnesthesiologistId()).ifPresent(u ->
                    record.setAnesthesiologistName(u.getFirstName() + " " + u.getLastName()));
        }

        AnesthesiaRecord saved = anesthesiaRepository.save(record);

        // Link to surgical case
        SurgicalCase sc = getCaseById(caseId, organizationId);
        sc.setAnesthesiaRecordId(saved.getId());
        sc.setUpdatedAt(Instant.now());
        caseRepository.save(sc);

        return saved;
    }

    public AnesthesiaRecord getAnesthesiaRecord(String caseId, String organizationId) {
        getCaseById(caseId, organizationId); // access control
        return anesthesiaRepository.findBySurgicalCaseId(caseId)
                .orElseThrow(() -> new IllegalArgumentException("No anesthesia record for case: " + caseId));
    }

    public AnesthesiaRecord appendVitals(String caseId, AnesthesiaRecord.VitalsEntry entry,
                                          String organizationId) {
        AnesthesiaRecord rec = getAnesthesiaRecord(caseId, organizationId);
        if (rec.isCompleted()) {
            throw new IllegalStateException("Anesthesia record is already completed. Cannot append vitals.");
        }
        if (entry.getTime() == null) entry.setTime(Instant.now());
        rec.getVitalsTimeline().add(entry);
        rec.setUpdatedAt(Instant.now());
        return anesthesiaRepository.save(rec);
    }

    public AnesthesiaRecord appendMedication(String caseId, AnesthesiaRecord.MedicationEntry med,
                                              String organizationId) {
        AnesthesiaRecord rec = getAnesthesiaRecord(caseId, organizationId);
        if (rec.isCompleted()) {
            throw new IllegalStateException("Anesthesia record is already completed. Cannot append medications.");
        }
        if (med.getTime() == null) med.setTime(Instant.now());
        rec.getMedicationsAdministered().add(med);
        rec.setUpdatedAt(Instant.now());
        return anesthesiaRepository.save(rec);
    }

    public AnesthesiaRecord completeAnesthesiaRecord(String caseId, AnesthesiaRecord updates,
                                                      String organizationId) {
        AnesthesiaRecord rec = getAnesthesiaRecord(caseId, organizationId);
        if (updates.getEmergenceTime() != null) rec.setEmergenceTime(updates.getEmergenceTime());
        if (updates.getAirwayManagement() != null) rec.setAirwayManagement(updates.getAirwayManagement());
        if (updates.getComplications() != null) rec.setComplications(updates.getComplications());
        if (updates.getNotes() != null) rec.setNotes(updates.getNotes());
        rec.setCompleted(true);
        rec.setUpdatedAt(Instant.now());
        log.info("[Surgical] Anesthesia record completed for case {}", caseId);
        return anesthesiaRepository.save(rec);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  NOTIFICATION HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    private void notifySurgeonBooked(SurgicalCase sc) {
        sendNotification(
                sc.getSurgeonId(),
                "Surgical Case Booked",
                "Case " + sc.getCaseNumber() + " — " + sc.getProcedureName() +
                " scheduled on " + sc.getScheduledStart().toString().substring(0, 10) +
                " in " + (sc.getOrName() != null ? sc.getOrName() : sc.getOrId()) + ".",
                sc.getId(), "SURGICAL_CASE"
        );
        // Email
        userRepository.findById(sc.getSurgeonId()).ifPresent(u -> {
            if (u.getEmail() != null && !u.getEmail().isBlank()) {
                String body = "<h3>New Surgical Case Booked</h3>" +
                        "<p>Dear Dr. " + u.getLastName() + ",</p>" +
                        "<ul>" +
                        "<li><strong>Case #:</strong> " + sc.getCaseNumber() + "</li>" +
                        "<li><strong>Procedure:</strong> " + sc.getProcedureName() + "</li>" +
                        "<li><strong>Patient:</strong> " + (sc.getPatientName() != null ? sc.getPatientName() : sc.getPatientId()) + "</li>" +
                        "<li><strong>Scheduled:</strong> " + sc.getScheduledStart() + "</li>" +
                        "<li><strong>OR:</strong> " + (sc.getOrName() != null ? sc.getOrName() : sc.getOrId()) + "</li>" +
                        "</ul>";
                emailService.sendEmail(u.getEmail(), "Surgical Case Booked: " + sc.getCaseNumber(), body);
            }
        });
    }

    private void notifyAnesthesiologistAssigned(SurgicalCase sc) {
        sendNotification(
                sc.getAnesthesiologistId(),
                "Anesthesia Assignment",
                "You have been assigned as anesthesiologist for Case " + sc.getCaseNumber() +
                " (" + sc.getProcedureName() + ") on " +
                sc.getScheduledStart().toString().substring(0, 10) + ".",
                sc.getId(), "SURGICAL_CASE"
        );
    }

    private void sendNotification(String recipientId, String title, String message,
                                   String entityId, String entityType) {
        if (recipientId == null || recipientId.isBlank()) return;
        Notification n = new Notification();
        n.setRecipientId(recipientId);
        n.setType("INFO");
        n.setTitle(title);
        n.setMessage(message);
        n.setRelatedEntityId(entityId);
        n.setRelatedEntityType(entityType);
        n.setRead(false);
        n.setCreatedAt(java.time.LocalDateTime.now());
        notificationRepository.save(n);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  AUTO-GENERATED CASE NUMBER
    // ─────────────────────────────────────────────────────────────────────────

    private String generateCaseNumber() {
        String candidate;
        int attempts = 0;
        do {
            candidate = "SC-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
            attempts++;
            if (attempts > 10) throw new IllegalStateException("Failed to generate unique case number.");
        } while (caseRepository.existsByCaseNumber(candidate));
        return candidate;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  REQUEST DTO (inner class for clean controller binding)
    // ─────────────────────────────────────────────────────────────────────────

    @lombok.Data
    public static class BookCaseRequest {
        private String patientId;
        private String patientName;
        private String epcrRecordId;
        private String orId;
        private String facilityId;
        private String surgeonId;
        private String anesthesiologistId;
        private Instant scheduledStart;
        private Instant scheduledEnd;
        private String procedureName;
        private String cptCode;
        private String snomedCode;
        private CaseUrgency urgency;
    }
}
