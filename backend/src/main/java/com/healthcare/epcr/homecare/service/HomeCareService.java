package com.healthcare.epcr.homecare.service;

import com.healthcare.epcr.homecare.enums.ReferralStatus;
import com.healthcare.epcr.homecare.enums.VisitStatus;
import com.healthcare.epcr.homecare.model.HomeCareReferral;
import com.healthcare.epcr.homecare.model.HomeCareVisit;
import com.healthcare.epcr.homecare.model.NurseCaseload;
import com.healthcare.epcr.homecare.repository.HomeCareReferralRepository;
import com.healthcare.epcr.homecare.repository.HomeCareVisitRepository;
import com.healthcare.epcr.homecare.repository.NurseCaseloadRepository;
import com.healthcare.epcr.notification.model.Notification;
import com.healthcare.epcr.notification.repository.NotificationRepository;
import com.healthcare.epcr.notification.service.EmailService;
import com.healthcare.epcr.billing.service.ProviderPayoutService;
import com.healthcare.epcr.user.model.User;
import com.healthcare.epcr.user.repository.UserRepository;
import com.healthcare.epcr.homecare.util.FrequencyParser;
import com.healthcare.epcr.epcr.repository.PatientCareRecordRepository;
import com.healthcare.epcr.epcr.model.PatientCareRecord;
import com.healthcare.epcr.phi.crypto.PhiCryptoService;
import lombok.RequiredArgsConstructor;
import java.util.Comparator;
import java.util.HashMap;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * HomeCareService — core business logic for the home care dispatch module.
 *
 * Key design decisions:
 * - Nurse assignment uses atomic findAndModify (same pattern as PatientScheduleService.bookSlot)
 * - Notifications reuse existing NotificationRepository (no Kafka needed)
 * - All org-scoped queries — no cross-org data leaks
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class HomeCareService {

    private final HomeCareReferralRepository referralRepository;
    private final HomeCareVisitRepository visitRepository;
    private final NurseCaseloadRepository caseloadRepository;
    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final MongoTemplate mongoTemplate;
    private final FrequencyParser frequencyParser;
    private final PatientCareRecordRepository patientCareRecordRepository;
    private final PhiCryptoService phiCryptoService;
    private final EmailService emailService;
    private final ProviderPayoutService providerPayoutService;

    // ─────────────────────────────────────────────────────────────────────────
    //  REFERRAL MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────────

    public HomeCareReferral createReferral(HomeCareReferral referral, String organizationId) {
        referral.setId(null);
        referral.setOrganizationId(organizationId);
        referral.setStatus(ReferralStatus.PENDING);
        referral.setCreatedAt(Instant.now());
        referral.setUpdatedAt(Instant.now());
        HomeCareReferral saved = referralRepository.save(referral);
        log.info("[HomeCare] Referral created: {} for patient {} in community {}",
                saved.getId(), saved.getPatientId(), saved.getHomeCommunity());
        return saved;
    }

    public HomeCareReferral activateReferral(String referralId) {
        HomeCareReferral referral = referralRepository.findById(referralId)
                .orElseThrow(() -> new IllegalArgumentException("Referral not found: " + referralId));
        referral.setStatus(ReferralStatus.ACTIVE);
        referral.setUpdatedAt(Instant.now());
        HomeCareReferral saved = referralRepository.save(referral);
        generateVisitsForReferral(saved);
        return saved;
    }

    public List<HomeCareReferral> getReferralsByOrg(String organizationId) {
        return referralRepository.findByOrganizationId(organizationId);
    }

    public List<HomeCareReferral> getReferralsByPatient(String patientId) {
        return referralRepository.findByPatientId(patientId);
    }

    public HomeCareReferral updateReferralStatus(String referralId, ReferralStatus status) {
        HomeCareReferral referral = referralRepository.findById(referralId)
                .orElseThrow(() -> new IllegalArgumentException("Referral not found: " + referralId));
        referral.setStatus(status);
        referral.setUpdatedAt(Instant.now());
        HomeCareReferral saved = referralRepository.save(referral);
        if (status == ReferralStatus.ACTIVE) {
            generateVisitsForReferral(saved);
        }
        return saved;
    }

    private void generateVisitsForReferral(HomeCareReferral referral) {
        try {
            List<LocalDate> visitDates = frequencyParser.resolveNext7Days(
                    referral.getFrequency(), referral.getStartDate());

            for (LocalDate date : visitDates) {
                if (!visitRepository.existsByReferralIdAndVisitDate(referral.getId(), date.toString())) {
                    HomeCareVisit visit = HomeCareVisit.builder()
                            .referralId(referral.getId())
                            .patientId(referral.getPatientId())
                            .patientName(referral.getPatientName())
                            .organizationId(referral.getOrganizationId())
                            .visitDate(date.toString())
                            .community(referral.getHomeCommunity())
                            .status(VisitStatus.UNASSIGNED)
                            .serviceType(referral.getServiceType() != null ? referral.getServiceType().name() : null)
                            .priority(referral.getPriority())
                            .careInstructions(referral.getCareInstructions())
                            .offlineCreated(false)
                            .createdAt(Instant.now())
                            .updatedAt(Instant.now())
                            .build();

                    visitRepository.save(visit);
                }
            }
            log.info("[HomeCare] Instantly generated visits for active referral {}", referral.getId());
        } catch (Exception e) {
            log.error("[HomeCare] Failed to instantly generate visits for referral {}", referral.getId(), e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  DISPATCH BOARD
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Returns all visits for a given date, optionally filtered by community.
     * Used by the dispatch board UI.
     */
    private void enrichPatientNames(List<HomeCareVisit> visits) {
        if (visits == null || visits.isEmpty()) return;
        java.util.Map<String, String> nameCache = new java.util.HashMap<>();
        for (HomeCareVisit v : visits) {
            if (v.getPatientName() == null || v.getPatientName().isBlank()) {
                String patientId = v.getPatientId();
                if (patientId != null && !patientId.isBlank()) {
                    String cachedName = nameCache.get(patientId);
                    if (cachedName != null) {
                        v.setPatientName(cachedName);
                    } else {
                        List<PatientCareRecord> records = patientCareRecordRepository.findByPatientId(patientId);
                        if (records != null && !records.isEmpty()) {
                            PatientCareRecord latest = records.stream()
                                    .max(java.util.Comparator.comparing(PatientCareRecord::getUpdatedAt,
                                            java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder())))
                                    .orElse(null);
                            if (latest != null && latest.getPatientName() != null) {
                                String decryptedName = phiCryptoService.decrypt(latest.getPatientName());
                                if (decryptedName != null && !decryptedName.isBlank()) {
                                    v.setPatientName(decryptedName);
                                    nameCache.put(patientId, decryptedName);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    public List<HomeCareVisit> getDispatchBoard(String organizationId, String date, String community) {
        List<HomeCareVisit> result;
        if (community != null && !community.isBlank()) {
            result = visitRepository.findByVisitDateAndCommunityAndOrganizationId(LocalDate.parse(date), community, organizationId);
        } else {
            result = visitRepository.findByVisitDateAndOrganizationId(date, organizationId);
        }
        enrichPatientNames(result);
        return result;
    }

    /**
     * Returns a nurse's full daily schedule.
     */
    public List<HomeCareVisit> getNurseSchedule(String nurseId, String date) {
        List<HomeCareVisit> result = visitRepository.findByAssignedNurseIdAndVisitDate(nurseId, date);
        enrichPatientNames(result);
        return result;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  ATOMIC NURSE ASSIGNMENT  (same findAndModify pattern as PatientScheduleService)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Atomically assigns a nurse to an UNASSIGNED visit.
     * Concurrent requests for the same visit: only one succeeds, others get ConflictException.
     */
    public HomeCareVisit assignNurse(String visitId, String nurseId, String timeWindow, String organizationId) {
        // Resolve nurse name for denormalization
        String nurseName = userRepository.findById(nurseId)
                .map(u -> u.getFirstName() + " " + u.getLastName())
                .orElse("Nurse (" + nurseId + ")");

        // Atomic assign: visit must be UNASSIGNED for this to succeed
        Query query = new Query(
                Criteria.where("id").is(visitId)
                        .and("status").is(VisitStatus.UNASSIGNED)
                        .and("organizationId").is(organizationId)
        );
        Update update = new Update()
                .set("assignedNurseId", nurseId)
                .set("assignedNurseName", nurseName)
                .set("status", VisitStatus.ASSIGNED)
                .set("timeWindow", timeWindow)
                .set("assignedAt", Instant.now())
                .set("updatedAt", Instant.now());

        HomeCareVisit result = mongoTemplate.findAndModify(
                query, update,
                FindAndModifyOptions.options().returnNew(true),
                HomeCareVisit.class
        );

        if (result == null) {
            throw new IllegalStateException(
                    "Visit is already assigned, cancelled, or does not belong to this organization. visitId=" + visitId);
        }

        // In-app notification to assigned nurse
        sendNotification(
                nurseId,
                "New Home Care Visit Assigned",
                "You have been assigned a home care visit for " + result.getVisitDate()
                        + " in " + result.getCommunity() + ". Time window: " + result.getTimeWindow(),
                result.getId(),
                "HOME_CARE_VISIT"
        );

        // Email notification
        userRepository.findById(nurseId).ifPresent(nurse -> {
            if (nurse.getEmail() != null && !nurse.getEmail().isBlank()) {
                String subject = "New Home Care Visit Assigned";
                String body = "<h3>Hello " + nurse.getFirstName() + " " + nurse.getLastName() + ",</h3>" +
                        "<p>You have been assigned a new home care visit.</p>" +
                        "<ul>" +
                        "<li><strong>Date:</strong> " + result.getVisitDate() + "</li>" +
                        "<li><strong>Community:</strong> " + result.getCommunity() + "</li>" +
                        "<li><strong>Time Window:</strong> " + result.getTimeWindow() + "</li>" +
                        "</ul>" +
                        "<p>Please check your application dashboard for complete details.</p>";
                emailService.sendEmail(nurse.getEmail(), subject, body);
            }
        });

        // In-app notification to patient
        String finalPatientName = result.getPatientName() != null ? result.getPatientName() : "Patient";
        sendNotification(
                result.getPatientId(),
                "Home Care Visit Scheduled",
                "A visit has been scheduled with Nurse " + nurseName + " on " + result.getVisitDate() + " (" + result.getTimeWindow() + ").",
                result.getId(),
                "HOME_CARE_VISIT"
        );

        // Email notification to patient
        try {
            List<PatientCareRecord> pcrRecords = patientCareRecordRepository.findByPatientId(result.getPatientId());
            if (pcrRecords != null && !pcrRecords.isEmpty()) {
                PatientCareRecord latestPcr = pcrRecords.stream()
                        .max(java.util.Comparator.comparing(PatientCareRecord::getUpdatedAt,
                                java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder())))
                        .orElse(null);
                if (latestPcr != null && latestPcr.getEmail() != null) {
                    String patientEmail = phiCryptoService.decrypt(latestPcr.getEmail());
                    if (patientEmail != null && !patientEmail.isBlank()) {
                        String patientSubject = "Your Home Care Visit is Scheduled";
                        String patientBody = "<h3>Hello " + finalPatientName + ",</h3>" +
                                "<p>A home care visit has been scheduled for you.</p>" +
                                "<ul>" +
                                "<li><strong>Date:</strong> " + result.getVisitDate() + "</li>" +
                                "<li><strong>Time Slot:</strong> " + result.getTimeWindow() + "</li>" +
                                "<li><strong>Assigned Nurse:</strong> " + nurseName + "</li>" +
                                "</ul>" +
                                "<p>Please be available at your registered home address during this time.</p>" +
                                "<p>Thank you,<br/>Community Care Operations Team</p>";
                        emailService.sendEmail(patientEmail, patientSubject, patientBody);
                    }
                }
            }
        } catch (Exception ex) {
            log.error("[HomeCare] Failed to send email to patient {}: {}", result.getPatientId(), ex.getMessage());
        }

        log.info("[HomeCare] Visit {} assigned to nurse {} ({})", visitId, nurseName, nurseId);
        return result;
    }

    /**
     * Re-assign a visit that is already ASSIGNED to a different nurse.
     * Used by supervisor to correct assignments.
     */
    public HomeCareVisit reassignNurse(String visitId, String newNurseId, String timeWindow, String organizationId) {
        String nurseName = userRepository.findById(newNurseId)
                .map(u -> u.getFirstName() + " " + u.getLastName())
                .orElse("Nurse (" + newNurseId + ")");

        Query query = new Query(
                Criteria.where("id").is(visitId)
                        .and("status").in(VisitStatus.ASSIGNED, VisitStatus.UNASSIGNED)
                        .and("organizationId").is(organizationId)
        );
        Update update = new Update()
                .set("assignedNurseId", newNurseId)
                .set("assignedNurseName", nurseName)
                .set("status", VisitStatus.ASSIGNED)
                .set("timeWindow", timeWindow)
                .set("assignedAt", Instant.now())
                .set("updatedAt", Instant.now());

        HomeCareVisit result = mongoTemplate.findAndModify(
                query, update,
                FindAndModifyOptions.options().returnNew(true),
                HomeCareVisit.class
        );

        if (result == null) {
            throw new IllegalStateException("Cannot reassign visit — invalid state. visitId=" + visitId);
        }

        sendNotification(newNurseId, "Home Care Visit Reassigned",
                "A visit on " + result.getVisitDate() + " in " + result.getCommunity() + " has been assigned to you.",
                result.getId(), "HOME_CARE_VISIT");

        // Email notification
        userRepository.findById(newNurseId).ifPresent(nurse -> {
            if (nurse.getEmail() != null && !nurse.getEmail().isBlank()) {
                String subject = "Home Care Visit Reassigned";
                String body = "<h3>Hello " + nurse.getFirstName() + " " + nurse.getLastName() + ",</h3>" +
                        "<p>A home care visit has been reassigned to you.</p>" +
                        "<ul>" +
                        "<li><strong>Date:</strong> " + result.getVisitDate() + "</li>" +
                        "<li><strong>Community:</strong> " + result.getCommunity() + "</li>" +
                        "<li><strong>Time Window:</strong> " + result.getTimeWindow() + "</li>" +
                        "</ul>" +
                        "<p>Please check your application dashboard for complete details.</p>";
                emailService.sendEmail(nurse.getEmail(), subject, body);
            }
        });

        // In-app notification to patient
        String finalPatientName = result.getPatientName() != null ? result.getPatientName() : "Patient";
        sendNotification(
                result.getPatientId(),
                "Home Care Visit Reassigned",
                "Your visit has been reassigned to Nurse " + nurseName + " on " + result.getVisitDate() + " (" + result.getTimeWindow() + ").",
                result.getId(),
                "HOME_CARE_VISIT"
        );

        // Email notification to patient
        try {
            List<PatientCareRecord> pcrRecords = patientCareRecordRepository.findByPatientId(result.getPatientId());
            if (pcrRecords != null && !pcrRecords.isEmpty()) {
                PatientCareRecord latestPcr = pcrRecords.stream()
                        .max(java.util.Comparator.comparing(PatientCareRecord::getUpdatedAt,
                                java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder())))
                        .orElse(null);
                if (latestPcr != null && latestPcr.getEmail() != null) {
                    String patientEmail = phiCryptoService.decrypt(latestPcr.getEmail());
                    if (patientEmail != null && !patientEmail.isBlank()) {
                        String patientSubject = "Your Home Care Visit Details Updated";
                        String patientBody = "<h3>Hello " + finalPatientName + ",</h3>" +
                                "<p>Your scheduled home care visit details have been updated.</p>" +
                                "<ul>" +
                                "<li><strong>Date:</strong> " + result.getVisitDate() + "</li>" +
                                "<li><strong>Time Slot:</strong> " + result.getTimeWindow() + "</li>" +
                                "<li><strong>Assigned Nurse:</strong> " + nurseName + "</li>" +
                                "</ul>" +
                                "<p>Please be available at your registered home address during this time.</p>" +
                                "<p>Thank you,<br/>Community Care Operations Team</p>";
                        emailService.sendEmail(patientEmail, patientSubject, patientBody);
                    }
                }
            }
        } catch (Exception ex) {
            log.error("[HomeCare] Failed to send email to patient {}: {}", result.getPatientId(), ex.getMessage());
        }

        return result;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  NURSE SUGGESTIONS (smart dispatch hints)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Suggests available nurses for a given visit based on community assignment and current caseload.
     * Returns a sorted list — lowest caseload first (best fit first).
     */
    public List<NurseSuggestionDTO> suggestNurses(String visitId, String organizationId) {
        HomeCareVisit visit = visitRepository.findById(visitId)
                .orElseThrow(() -> new IllegalArgumentException("Visit not found: " + visitId));

        List<NurseCaseload> caseloads = caseloadRepository
                .findByOrganizationIdAndAssignedCommunitiesContainingAndDate(
                        organizationId, visit.getCommunity(), visit.getVisitDate().toString());

        return caseloads.stream()
                .filter(c -> Boolean.TRUE.equals(c.getAvailable()))
                .filter(c -> userRepository.findById(c.getNurseId())
                        .map(u -> u.getRole() == com.healthcare.epcr.user.model.Role.PARAMEDIC)
                        .orElse(false))
                .map(c -> {
                    long currentLoad = visitRepository.countByAssignedNurseIdAndVisitDate(
                            c.getNurseId(), visit.getVisitDate());
                    int maxLoad = c.getMaxDailyVisits() != null ? c.getMaxDailyVisits() : 8;
                    double score = maxLoad > 0 ? (double) currentLoad / maxLoad : 1.0;
                    return new NurseSuggestionDTO(c.getNurseId(), c.getNurseName(), currentLoad, maxLoad, score);
                })
                .sorted(java.util.Comparator.comparingDouble(NurseSuggestionDTO::getScore))
                .collect(Collectors.toList());
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  FIELD CHECK-IN / CHECK-OUT
    // ─────────────────────────────────────────────────────────────────────────

    public HomeCareVisit checkIn(String visitId, Instant checkInAt, Double latitude, Double longitude, Boolean offlineCreated) {
        HomeCareVisit visit = visitRepository.findById(visitId)
                .orElseThrow(() -> new IllegalArgumentException("Visit not found: " + visitId));

        visit.setStatus(VisitStatus.IN_PROGRESS);
        visit.setCheckInAt(checkInAt != null ? checkInAt : Instant.now());
        if (latitude != null) visit.setLatitude(latitude);
        if (longitude != null) visit.setLongitude(longitude);
        if (offlineCreated != null) visit.setOfflineCreated(offlineCreated);
        visit.setUpdatedAt(Instant.now());

        HomeCareVisit saved = visitRepository.save(visit);
        log.info("[HomeCare] Visit {} check-in recorded at {}", visitId, saved.getCheckInAt());
        return saved;
    }

    public HomeCareVisit checkOut(String visitId, Instant checkOutAt, String notes, String vitalsRecorded, Boolean offlineCreated) {
        HomeCareVisit visit = visitRepository.findById(visitId)
                .orElseThrow(() -> new IllegalArgumentException("Visit not found: " + visitId));

        visit.setStatus(VisitStatus.COMPLETED);
        visit.setCheckOutAt(checkOutAt != null ? checkOutAt : Instant.now());
        if (notes != null) visit.setVisitNotes(notes);
        if (vitalsRecorded != null) visit.setVitalsRecorded(vitalsRecorded);
        if (offlineCreated != null) visit.setOfflineCreated(offlineCreated);
        visit.setUpdatedAt(Instant.now());

        HomeCareVisit saved = visitRepository.save(visit);
        log.info("[HomeCare] Visit {} completed. Nurse: {}", visitId, saved.getAssignedNurseName());

        if (saved.getAssignedNurseId() != null) {
            try {
                java.time.LocalDateTime start = saved.getCheckInAt() != null 
                        ? java.time.LocalDateTime.ofInstant(saved.getCheckInAt(), java.time.ZoneOffset.UTC) 
                        : java.time.LocalDateTime.now();
                java.time.LocalDateTime end = saved.getCheckOutAt() != null 
                        ? java.time.LocalDateTime.ofInstant(saved.getCheckOutAt(), java.time.ZoneOffset.UTC) 
                        : java.time.LocalDateTime.now();
                providerPayoutService.logShiftFromSource(
                        saved.getAssignedNurseId(),
                        start,
                        end,
                        "HOMECARE_VISIT",
                        saved.getId(),
                        saved.getOrganizationId()
                );
            } catch (Exception e) {
                log.error("[HomeCare] Failed to log shift to provider payments for visit {}", visitId, e);
            }
        }
        return saved;
    }

    public HomeCareVisit cancelVisit(String visitId, String organizationId) {
        HomeCareVisit visit = visitRepository.findById(visitId)
                .orElseThrow(() -> new IllegalArgumentException("Visit not found: " + visitId));
        visit.setStatus(VisitStatus.CANCELLED);
        visit.setUpdatedAt(Instant.now());
        return visitRepository.save(visit);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  CASELOAD MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────────

    public NurseCaseload upsertCaseload(NurseCaseload caseload) {
        Optional<NurseCaseload> existing = caseloadRepository.findByNurseIdAndDate(
                caseload.getNurseId(), caseload.getDate());
        if (existing.isPresent()) {
            NurseCaseload ex = existing.get();
            ex.setAssignedCommunities(caseload.getAssignedCommunities());
            ex.setMaxDailyVisits(caseload.getMaxDailyVisits());
            ex.setAvailable(caseload.getAvailable());
            return caseloadRepository.save(ex);
        }
        return caseloadRepository.save(caseload);
    }

    public List<NurseCaseload> getCaseloadsByOrg(String organizationId, String date) {
        return caseloadRepository.findByOrganizationIdAndDate(organizationId, date);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  MISSED VISIT DETECTION (called by daily job)
    // ─────────────────────────────────────────────────────────────────────────

    public int markMissedVisits(String supervisorId) {
        String todayStr = LocalDate.now().toString();
        List<HomeCareVisit> stillAssigned = visitRepository
                .findByVisitDateBeforeAndStatus(todayStr, VisitStatus.ASSIGNED);

        int count = 0;
        for (HomeCareVisit v : stillAssigned) {
            v.setStatus(VisitStatus.MISSED);
            v.setUpdatedAt(Instant.now());
            visitRepository.save(v);

            // Escalate to supervisor
            if (supervisorId != null) {
                sendNotification(supervisorId, "⚠️ Missed Home Care Visit",
                        "Visit for patient " + v.getPatientId() + " on " + v.getVisitDate()
                                + " in " + v.getCommunity() + " was not completed. Nurse: " + v.getAssignedNurseName(),
                        v.getId(), "HOME_CARE_VISIT");
            }
            count++;
        }

        if (count > 0) {
            log.warn("[HomeCare] Marked {} visit(s) as MISSED for today: {}", count, todayStr);
        }
        return count;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  DELETE OPERATIONS
    // ─────────────────────────────────────────────────────────────────────────

    public void deleteReferral(String referralId, String organizationId) {
        HomeCareReferral referral = referralRepository.findById(referralId)
                .orElseThrow(() -> new IllegalArgumentException("Referral not found: " + referralId));
        if (!referral.getOrganizationId().equals(organizationId)) {
            throw new SecurityException("Unauthorized access to delete referral.");
        }
        referralRepository.delete(referral);

        // Delete all associated visits that have not started (UNASSIGNED or ASSIGNED, but not IN_PROGRESS or COMPLETED)
        List<HomeCareVisit> visits = visitRepository.findByReferralId(referralId);
        List<HomeCareVisit> toDelete = visits.stream()
                .filter(v -> v.getStatus() == VisitStatus.UNASSIGNED || v.getStatus() == VisitStatus.ASSIGNED)
                .collect(Collectors.toList());
        visitRepository.deleteAll(toDelete);
        log.info("[HomeCare] Deleted referral {} and its {} associated unstarted visits.", referralId, toDelete.size());
    }

    public void deleteCaseload(String caseloadId, String organizationId) {
        NurseCaseload caseload = caseloadRepository.findById(caseloadId)
                .orElseThrow(() -> new IllegalArgumentException("Caseload not found: " + caseloadId));
        if (!caseload.getOrganizationId().equals(organizationId)) {
            throw new SecurityException("Unauthorized access to delete caseload.");
        }
        caseloadRepository.delete(caseload);
        log.info("[HomeCare] Deleted caseload allocation {}", caseloadId);
    }

    public List<HomeCareVisit> getVisitsByPatient(String patientId) {
        List<HomeCareVisit> visits = visitRepository.findByPatientId(patientId);
        enrichPatientNames(visits);
        return visits;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  PRIVATE HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    private void sendNotification(String recipientId, String title, String message,
                                  String entityId, String entityType) {
        try {
            Notification notification = new Notification();
            notification.setRecipientId(recipientId);
            notification.setType("INFO");
            notification.setTitle(title);
            notification.setMessage(message);
            notification.setRelatedEntityId(entityId);
            notification.setRelatedEntityType(entityType);
            notification.setRead(false);
            notification.setCreatedAt(LocalDateTime.now());
            notificationRepository.save(notification);
        } catch (Exception e) {
            log.error("[HomeCare] Failed to send notification to {}: {}", recipientId, e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  DTO
    // ─────────────────────────────────────────────────────────────────────────

    @lombok.Data
    @lombok.AllArgsConstructor
    public static class NurseSuggestionDTO {
        private String nurseId;
        private String nurseName;
        private long currentLoad;
        private int maxLoad;
        private double score; // 0.0 = fully free, 1.0 = at capacity
    }
}
