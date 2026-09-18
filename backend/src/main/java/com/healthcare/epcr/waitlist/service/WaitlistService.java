package com.healthcare.epcr.waitlist.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.healthcare.epcr.common.exception.IdempotencyInProgressException;
import com.healthcare.epcr.common.exception.ResourceNotFoundException;
import com.healthcare.epcr.idempotency.model.IdempotencyRequest;
import com.healthcare.epcr.idempotency.repository.IdempotencyRequestRepository;
import com.healthcare.epcr.notification.model.Notification;
import com.healthcare.epcr.notification.repository.NotificationRepository;
import com.healthcare.epcr.scheduling.model.Appointment;
import com.healthcare.epcr.scheduling.model.AppointmentSlot;
import com.healthcare.epcr.scheduling.repository.AppointmentRepository;
import com.healthcare.epcr.scheduling.repository.AppointmentSlotRepository;
import com.healthcare.epcr.security.AccessControlService;
import com.healthcare.epcr.user.model.Role;
import com.healthcare.epcr.user.model.User;
import com.healthcare.epcr.waitlist.dto.*;
import com.healthcare.epcr.waitlist.enums.WaitlistPriority;
import com.healthcare.epcr.waitlist.enums.WaitlistStatus;
import com.healthcare.epcr.waitlist.model.WaitlistEntry;
import com.healthcare.epcr.waitlist.repository.WaitlistEntryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * Core business logic for the Waitlist Management module.
 *
 * Key design decisions matching existing patterns:
 * 1. Idempotency: Same pattern as PatientCareRecordServiceImpl — IdempotencyRequestRepository
 *    deduplicates concurrent/duplicate submissions.
 * 2. Atomic slot offering: Uses mongoTemplate.findAndModify (same pattern as
 *    PatientScheduleService.bookSlot and HomeCareService nurse assignment).
 * 3. No stored position field: Position computed via countDocuments query on the ESR index.
 * 4. Redis cache for queue view: invalidated on every write.
 * 5. WebSocket notification on slot offered: same pattern as FeedbackWebSocketController.
 * 6. Kafka events: Simulated via log.info (no Kafka dependency — can be wired when needed).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WaitlistService {

    // ── Dependencies ─────────────────────────────────────────────────────────

    private final WaitlistEntryRepository waitlistRepository;
    private final IdempotencyRequestRepository idempotencyRequestRepository;
    private final NotificationRepository notificationRepository;
    private final AppointmentSlotRepository slotRepository;
    private final AppointmentRepository appointmentRepository;
    private final MongoTemplate mongoTemplate;
    private final RedisTemplate<String, Object> redisTemplate;
    private final SimpMessagingTemplate messagingTemplate;
    private final AccessControlService accessControlService;

    /** Average service slot duration in minutes — used for wait time estimation */
    private static final int AVG_SERVICE_DURATION_MIN = 30;

    /** Offer TTL: 24 hours */
    private static final long OFFER_TTL_HOURS = 24;

    /** Redis cache TTL for queue view: 45 seconds */
    private static final long QUEUE_CACHE_TTL_SECONDS = 45;

    // ── Queue Cache Key ───────────────────────────────────────────────────────

    private String queueCacheKey(String facilityId, String serviceType) {
        return "waitlist:queue:" + facilityId + ":" + serviceType;
    }

    // ── 1. Add to Waitlist (Idempotent) ──────────────────────────────────────

    /**
     * Adds a patient to the waitlist.
     * Uses the same idempotency key pattern as ePCR record creation so that
     * duplicate network submits from the UI do not create duplicate entries.
     *
     * Header: Idempotency-Key
     */
    public WaitlistEntryDTO addToWaitlist(AddToWaitlistRequest request, String idempotencyKey) {
        User currentUser = accessControlService.currentUser();
        accessControlService.assertOrganizationAccess(currentUser.getOrganizationId());

        String normalizedKey = normalizeIdempotencyKey(idempotencyKey);

        if (normalizedKey != null) {
            // Idempotency check: if same key already completed, return cached result
            String markerId = idempotencyMarkerId(currentUser.getId(), normalizedKey);
            IdempotencyRequest existing = idempotencyRequestRepository.findById(markerId).orElse(null);
            if (existing != null && "COMPLETED".equals(existing.getStatus()) && existing.getResourceId() != null) {
                WaitlistEntry existingEntry = waitlistRepository.findById(existing.getResourceId())
                        .orElseThrow(() -> new ResourceNotFoundException("Idempotent waitlist entry not found: " + existing.getResourceId()));
                log.info("[Waitlist] Duplicate add-to-waitlist request detected. key={} → entry={}", normalizedKey, existingEntry.getId());
                return mapToDTO(existingEntry);
            }
            if (existing != null && "PROCESSING".equals(existing.getStatus())) {
                throw new IdempotencyInProgressException("Waitlist request with this Idempotency-Key is still processing");
            }
        }

        // Reserve idempotency marker
        IdempotencyRequest marker = null;
        if (normalizedKey != null) {
            marker = reserveIdempotencyMarker(currentUser.getId(), normalizedKey);
        }

        try {
            WaitlistEntry entry = new WaitlistEntry();
            entry.setOrganizationId(currentUser.getOrganizationId());
            entry.setFacilityId(request.getFacilityId());
            entry.setServiceType(request.getServiceType().toUpperCase());
            entry.setPatientId(request.getPatientId());
            entry.setPatientName(request.getPatientName());
            entry.setRequestedBy(currentUser.getId());
            entry.setPriority(request.getPriority());
            entry.setPriorityScore(request.getPriority().getScore());
            entry.setReasonForVisit(request.getReasonForVisit());
            entry.setNotes(request.getNotes());
            entry.setStatus(WaitlistStatus.WAITING);
            entry.setCreatedAt(Instant.now());
            entry.setStatusUpdatedAt(Instant.now());

            WaitlistEntry saved = waitlistRepository.save(entry);

            if (marker != null) {
                completeIdempotencyMarker(marker, saved.getId());
            }

            // Invalidate queue cache for this facility + serviceType
            invalidateQueueCache(saved.getFacilityId(), saved.getServiceType());

            log.info("[Waitlist] Added entry: patient={} facility={} serviceType={} priority={} id={}",
                    saved.getPatientId(), saved.getFacilityId(), saved.getServiceType(),
                    saved.getPriority(), saved.getId());

            // ── Auto-offer: find earliest OPEN slot starting from TOMORROW onwards ──
            // Waitlist is for future scheduling, not same-day leftover slots.
            // Patient gets the first available slot from the next calendar day.
            try {
                Instant startOfTomorrow = LocalDate.now(ZoneId.systemDefault())
                        .plusDays(1)
                        .atStartOfDay(ZoneId.systemDefault())
                        .toInstant();
                Query openSlotQuery = Query.query(
                        Criteria.where("facilityId").is(saved.getFacilityId())
                                .and("status").is("OPEN")
                                .and("slotStart").gte(startOfTomorrow));
                openSlotQuery.with(org.springframework.data.domain.Sort.by(
                        org.springframework.data.domain.Sort.Order.asc("slotStart")));
                openSlotQuery.limit(1);
                AppointmentSlot openSlot = mongoTemplate.findOne(openSlotQuery, AppointmentSlot.class);
                if (openSlot != null) {
                    log.info("[Waitlist] Auto-offering next-day slot {} to newly added patient {}", openSlot.getId(), saved.getPatientId());
                    offerNextSlot(saved.getOrganizationId(), saved.getFacilityId(), saved.getServiceType(), openSlot.getId());
                } else {
                    log.info("[Waitlist] No open future slots found (from tomorrow) for facility={} serviceType={} — patient queued, will be offered when slots are generated.",
                            saved.getFacilityId(), saved.getServiceType());
                }
            } catch (Exception ex) {
                log.warn("[Waitlist] Auto-offer attempt failed (non-blocking): {}", ex.getMessage());
            }

            return mapToDTO(saved);

        } catch (RuntimeException ex) {
            if (marker != null && marker.getResourceId() == null) {
                idempotencyRequestRepository.deleteById(marker.getId());
            }
            throw ex;
        }
    }

    // ── 2. Get Queue (with position + estimated wait) ─────────────────────────

    /**
     * Returns the sorted WAITING queue for a facility + serviceType.
     * Results are cached in Redis for QUEUE_CACHE_TTL_SECONDS seconds.
     *
     * Position is computed dynamically per entry:
     *   position = count(entries where priorityScore > this.priorityScore)
     *            + count(entries where priorityScore == this.priorityScore AND createdAt < this.createdAt)
     *            + 1
     *
     * This is always accurate because it reads from the live ESR index.
     */
    @SuppressWarnings("unchecked")
    public WaitlistQueueResponse getQueue(String organizationId, String facilityId, String serviceType) {
        String cacheKey = queueCacheKey(facilityId, serviceType);

        // Try Redis cache first
        try {
            Object cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached != null) {
                log.debug("[Waitlist] Cache HIT for key={}", cacheKey);
                ObjectMapper mapper = buildObjectMapper();
                return mapper.convertValue(cached, WaitlistQueueResponse.class);
            }
        } catch (Exception e) {
            log.warn("[Waitlist] Redis cache read failed, proceeding to MongoDB. key={} err={}", cacheKey, e.getMessage());
        }

        // Fetch from MongoDB — leverages ESR index
        List<WaitlistEntry> entries =
                waitlistRepository.findByOrganizationIdAndFacilityIdAndServiceTypeAndStatusInOrderByPriorityScoreDescCreatedAtAsc(
                        organizationId, facilityId, serviceType.toUpperCase(), List.of(WaitlistStatus.WAITING, WaitlistStatus.OFFERED));

        List<WaitlistQueueEntry> queue = new ArrayList<>();
        for (WaitlistEntry entry : entries) {
            WaitlistQueueEntry qe = new WaitlistQueueEntry();
            qe.setId(entry.getId());
            qe.setPatientId(entry.getPatientId());
            qe.setPatientName(entry.getPatientName());
            qe.setPriority(entry.getPriority());
            qe.setPriorityScore(entry.getPriorityScore());
            qe.setReasonForVisit(entry.getReasonForVisit());
            qe.setStatus(entry.getStatus());
            qe.setCreatedAt(entry.getCreatedAt());
            qe.setOfferedAt(entry.getOfferedAt());
            qe.setOfferExpiresAt(entry.getOfferExpiresAt());
            qe.setNotes(entry.getNotes());
            qe.setServiceType(entry.getServiceType());
            qe.setFacilityId(entry.getFacilityId());

            // Compute dynamic position
            int pos = computeDynamicPosition(organizationId, facilityId, serviceType.toUpperCase(), entry);
            qe.setQueuePosition(pos);
            qe.setEstimatedWaitMinutes(pos * AVG_SERVICE_DURATION_MIN);

            queue.add(qe);
        }

        // Sort by computed position (should already be ordered from DB, but ensure consistency)
        queue.sort((a, b) -> Integer.compare(a.getQueuePosition(), b.getQueuePosition()));

        WaitlistQueueResponse response = new WaitlistQueueResponse();
        response.setFacilityId(facilityId);
        response.setServiceType(serviceType.toUpperCase());
        response.setTotalWaiting(queue.size());
        response.setEntries(queue);

        // Write to Redis cache
        try {
            redisTemplate.opsForValue().set(cacheKey, response, QUEUE_CACHE_TTL_SECONDS, TimeUnit.SECONDS);
        } catch (Exception e) {
            log.warn("[Waitlist] Redis cache write failed. key={} err={}", cacheKey, e.getMessage());
        }

        return response;
    }

    private int computeDynamicPosition(String organizationId, String facilityId, String serviceType, WaitlistEntry entry) {
        if (entry.getStatus() == WaitlistStatus.OFFERED) {
            return 0; // Offered slots are dynamically ranked at position 0 (top priority)
        }
        // Count entries with a strictly higher priority score (they are ahead of this entry)
        long aheadByPriority = waitlistRepository
                .countByOrganizationIdAndFacilityIdAndServiceTypeAndStatusAndPriorityScoreGreaterThan(
                        organizationId, facilityId, serviceType, WaitlistStatus.WAITING, entry.getPriorityScore());

        // Count entries with same priority score but earlier createdAt (tie-break: FIFO)
        long aheadBySameScoreFifo = waitlistRepository
                .countByOrganizationIdAndFacilityIdAndServiceTypeAndStatusAndPriorityScoreAndCreatedAtBefore(
                        organizationId, facilityId, serviceType, WaitlistStatus.WAITING,
                        entry.getPriorityScore(), entry.getCreatedAt());

        return (int) (aheadByPriority + aheadBySameScoreFifo + 1);
    }

    // ── 3. Offer Next Slot (Race-Condition-Critical — Atomic findAndModify) ──

    /**
     * When an appointment slot is freed (cancellation), this is called to atomically
     * offer it to the highest-priority WAITING patient in the queue.
     *
     * Uses mongoTemplate.findAndModify — same pattern as PatientScheduleService.bookSlot.
     * Only ONE thread can win the findAndModify; concurrent cancellations cannot
     * double-offer the same patient.
     *
     * @param organizationId  org scope
     * @param facilityId      facility where the slot opened
     * @param serviceType     type of service the slot belongs to
     * @param slotId          ID of the AppointmentSlot that opened up
     * @return the WaitlistEntry that received the offer, or null if queue is empty
     */
    public WaitlistEntry offerNextSlot(String organizationId, String facilityId, String serviceType, String slotId) {
        Query query = new Query(Criteria
                .where("organizationId").is(organizationId)
                .and("facilityId").is(facilityId)
                .and("serviceType").is(serviceType.toUpperCase())
                .and("status").is(WaitlistStatus.WAITING));
        query.with(org.springframework.data.domain.Sort.by(
                org.springframework.data.domain.Sort.Order.desc("priorityScore"),
                org.springframework.data.domain.Sort.Order.asc("createdAt")));
        query.limit(1);

        Instant now = Instant.now();
        Update update = new Update()
                .set("status", WaitlistStatus.OFFERED)
                .set("offeredSlotId", slotId)
                .set("offeredAt", now)
                .set("offerExpiresAt", now.plus(OFFER_TTL_HOURS, ChronoUnit.HOURS))
                .set("statusUpdatedAt", now);

        WaitlistEntry offered = mongoTemplate.findAndModify(
                query, update,
                FindAndModifyOptions.options().returnNew(true),
                WaitlistEntry.class);

        if (offered == null) {
            log.info("[Waitlist] Queue is empty for facility={} serviceType={} — no offer made.", facilityId, serviceType);
            return null;
        }

        // Lock the slot to OFFERED so the cleanup job cannot delete it while patient decides.
        // The slot is returned to OPEN if the offer expires or is declined.
        mongoTemplate.updateFirst(
                Query.query(Criteria.where("id").is(slotId).and("status").is("OPEN")),
                Update.update("status", "OFFERED"),
                AppointmentSlot.class);

        log.info("[Waitlist] Slot offered atomically: entry={} patient={} slotId={} expires={}",
                offered.getId(), offered.getPatientId(), slotId, offered.getOfferExpiresAt());

        // Invalidate queue cache
        invalidateQueueCache(facilityId, serviceType);

        // Send notifications
        sendSlotOfferedNotification(offered);

        // Simulate Kafka event (wire to KafkaTemplate when Kafka dependency added)
        log.info("[Kafka Event] Topic=waitlist.slot.offered payload={{ entryId={}, patientId={}, slotId={}, facilityId={}, serviceType={} }}",
                offered.getId(), offered.getPatientId(), slotId, facilityId, serviceType);

        return offered;
    }

    // ── 4. Accept Offer ───────────────────────────────────────────────────────

    /**
     * Patient or staff accepts a slot offer.
     * Books the offered slot, creates an Appointment, and moves entry to SCHEDULED.
     */
    public WaitlistEntryDTO acceptOffer(String entryId, String organizationId) {
        WaitlistEntry entry = getEntryOrThrow(entryId);
        assertSameOrg(entry.getOrganizationId(), organizationId);

        if (entry.getStatus() != WaitlistStatus.OFFERED) {
            throw new IllegalStateException("Entry is not in OFFERED state: " + entryId + " (current: " + entry.getStatus() + ")");
        }
        if (entry.getOfferExpiresAt() != null && entry.getOfferExpiresAt().isBefore(Instant.now())) {
            throw new IllegalStateException("Offer has expired for entry: " + entryId);
        }

        // Atomically book the slot: OFFERED → BOOKED (slot was locked to OFFERED when first offered)
        String slotId = entry.getOfferedSlotId();
        Query slotQuery = Query.query(Criteria.where("id").is(slotId).and("status").in("OFFERED", "OPEN"));
        Update slotUpdate = new Update().set("status", "BOOKED");
        AppointmentSlot slot = mongoTemplate.findAndModify(
                slotQuery, slotUpdate,
                FindAndModifyOptions.options().returnNew(true),
                AppointmentSlot.class);

        if (slot == null) {
            // Slot was deleted or booked by someone else — re-queue the entry
            log.warn("[Waitlist] Offered slot {} is no longer available for entry {}. Re-queuing.", slotId, entryId);
            reQueueEntry(entry, "Offered slot no longer available");
            throw new IllegalStateException("The offered slot is no longer available. You have been re-queued. Please wait for a new offer.");
        }

        // Create the Appointment
        Appointment appt = new Appointment();
        appt.setSlotId(slot.getId());
        appt.setPatientId(entry.getPatientId());
        appt.setPatientName(entry.getPatientName());
        appt.setProviderId(slot.getProviderId());
        appt.setOrganizationId(entry.getOrganizationId());
        appt.setFacilityId(slot.getFacilityId());
        appt.setScheduledStart(slot.getSlotStart());
        appt.setScheduledEnd(slot.getSlotEnd());
        appt.setReasonForVisit(entry.getReasonForVisit());
        appt.setAppointmentType(entry.getServiceType());
        appt.setStatus("SCHEDULED");
        appt.setCreatedAt(Instant.now());
        appt.setUpdatedAt(Instant.now());
        Appointment savedAppt = appointmentRepository.save(appt);

        // Link appointment back to slot
        mongoTemplate.updateFirst(
                Query.query(Criteria.where("id").is(slot.getId())),
                Update.update("appointmentId", savedAppt.getId()),
                AppointmentSlot.class);

        // Transition entry to SCHEDULED
        Instant now = Instant.now();
        entry.setStatus(WaitlistStatus.SCHEDULED);
        entry.setScheduledAppointmentId(savedAppt.getId());
        entry.setStatusUpdatedAt(now);
        WaitlistEntry saved = waitlistRepository.save(entry);

        invalidateQueueCache(saved.getFacilityId(), saved.getServiceType());

        log.info("[Waitlist] Offer accepted: entry={} patient={} → appointment={}",
                saved.getId(), saved.getPatientId(), savedAppt.getId());

        // Notify patient of confirmed appointment — readable local time
        String appointmentTimeStr;
        try {
            java.time.ZonedDateTime localStart = slot.getSlotStart()
                    .atZone(ZoneId.systemDefault());
            appointmentTimeStr = localStart.format(java.time.format.DateTimeFormatter.ofPattern("EEEE, dd MMM yyyy 'at' hh:mm a z"));
        } catch (Exception e) {
            appointmentTimeStr = slot.getSlotStart() != null ? slot.getSlotStart().toString() : "your selected time";
        }

        sendNotification(saved.getPatientId(), "✅ Appointment Confirmed!",
                "Your appointment has been successfully booked for " + appointmentTimeStr +
                ". Service: " + saved.getServiceType() + ". Please arrive 10 minutes early.",
                "SUCCESS", saved.getId());

        // WebSocket real-time push so UI updates immediately
        try {
            messagingTemplate.convertAndSendToUser(
                    saved.getPatientId(),
                    "/queue/notifications",
                    Map.of(
                            "type", "APPOINTMENT_BOOKED",
                            "entryId", saved.getId(),
                            "appointmentId", savedAppt.getId(),
                            "scheduledAt", appointmentTimeStr,
                            "serviceType", saved.getServiceType(),
                            "message", "Your appointment is confirmed for " + appointmentTimeStr
                    )
            );
        } catch (Exception e) {
            log.warn("[Waitlist] WebSocket booking confirmation failed: {}", e.getMessage());
        }

        return mapToDTO(saved);
    }

    // ── 5. Decline Offer ─────────────────────────────────────────────────────

    /**
     * Patient or staff declines a slot offer.
     * Frees the slot back to OPEN and sets entry status to DECLINED.
     * Triggers offer for the next patient in queue.
     */
    public WaitlistEntryDTO declineOffer(String entryId, String organizationId) {
        WaitlistEntry entry = getEntryOrThrow(entryId);
        assertSameOrg(entry.getOrganizationId(), organizationId);

        if (entry.getStatus() != WaitlistStatus.OFFERED) {
            throw new IllegalStateException("Entry is not in OFFERED state: " + entryId);
        }

        String slotId = entry.getOfferedSlotId();

        // Free the slot back to OPEN
        if (slotId != null) {
            mongoTemplate.updateFirst(
                    Query.query(Criteria.where("id").is(slotId)),
                    new Update().set("status", "OPEN").set("appointmentId", null),
                    AppointmentSlot.class);
        }

        // Mark entry as DECLINED
        Instant now = Instant.now();
        entry.setStatus(WaitlistStatus.DECLINED);
        entry.setStatusUpdatedAt(now);
        entry.setOfferedSlotId(null);
        WaitlistEntry saved = waitlistRepository.save(entry);

        invalidateQueueCache(saved.getFacilityId(), saved.getServiceType());

        log.info("[Waitlist] Offer declined: entry={} patient={} slot={}", saved.getId(), saved.getPatientId(), slotId);

        // Offer slot to next patient in queue
        if (slotId != null) {
            offerNextSlot(saved.getOrganizationId(), saved.getFacilityId(), saved.getServiceType(), slotId);
        }

        return mapToDTO(saved);
    }

    // ── 6. Update Priority ────────────────────────────────────────────────────

    /**
     * Staff can update a WAITING entry's priority (ADMIN, PHYSICIAN, PARAMEDIC).
     * Uses optimistic locking via @Version to prevent concurrent priority updates.
     */
    public WaitlistEntryDTO updatePriority(String entryId, WaitlistPriority newPriority, String organizationId) {
        WaitlistEntry entry = getEntryOrThrow(entryId);
        assertSameOrg(entry.getOrganizationId(), organizationId);

        if (entry.getStatus() != WaitlistStatus.WAITING) {
            throw new IllegalStateException("Can only update priority for WAITING entries. Current status: " + entry.getStatus());
        }

        entry.setPriority(newPriority);
        entry.setPriorityScore(newPriority.getScore());
        entry.setStatusUpdatedAt(Instant.now());
        WaitlistEntry saved = waitlistRepository.save(entry); // optimistic lock via @Version

        invalidateQueueCache(saved.getFacilityId(), saved.getServiceType());

        log.info("[Waitlist] Priority updated: entry={} → {}", entryId, newPriority);
        return mapToDTO(saved);
    }

    // ── 7. Remove Entry ───────────────────────────────────────────────────────

    /**
     * Removes a waitlist entry (ADMIN, PHYSICIAN, PARAMEDIC or owning patient).
     */
    public void removeEntry(String entryId, String organizationId) {
        WaitlistEntry entry = getEntryOrThrow(entryId);
        assertSameOrg(entry.getOrganizationId(), organizationId);

        if (entry.getStatus() == WaitlistStatus.SCHEDULED) {
            throw new IllegalStateException("Cannot remove an entry that has already been SCHEDULED.");
        }

        // If it was OFFERED, free the slot
        if (entry.getStatus() == WaitlistStatus.OFFERED && entry.getOfferedSlotId() != null) {
            mongoTemplate.updateFirst(
                    Query.query(Criteria.where("id").is(entry.getOfferedSlotId())),
                    new Update().set("status", "OPEN").set("appointmentId", null),
                    AppointmentSlot.class);
            // Offer to next patient
            offerNextSlot(entry.getOrganizationId(), entry.getFacilityId(), entry.getServiceType(), entry.getOfferedSlotId());
        }

        entry.setStatus(WaitlistStatus.REMOVED);
        entry.setStatusUpdatedAt(Instant.now());
        waitlistRepository.save(entry);

        invalidateQueueCache(entry.getFacilityId(), entry.getServiceType());

        log.info("[Waitlist] Entry removed: entry={} patient={}", entryId, entry.getPatientId());
    }

    // ── 8. Get Entry by ID ────────────────────────────────────────────────────

    public WaitlistEntryDTO getEntryById(String entryId, String organizationId) {
        WaitlistEntry entry = getEntryOrThrow(entryId);
        // PATIENT role: can only see their own entry; staff: org-scoped
        User currentUser = accessControlService.currentUser();
        if (currentUser.getRole() == Role.PATIENT) {
            if (!entry.getPatientId().equals(currentUser.getId())) {
                throw new IllegalArgumentException("Access denied: patient can only view their own waitlist entry.");
            }
        } else {
            assertSameOrg(entry.getOrganizationId(), organizationId);
        }
        return mapToDTO(entry);
    }

    // ── 9. Stats ──────────────────────────────────────────────────────────────

    public WaitlistStatsDTO getStats(String organizationId) {
        WaitlistStatsDTO stats = new WaitlistStatsDTO();
        stats.setOrganizationId(organizationId);
        stats.setTotalWaiting(waitlistRepository.countByOrganizationIdAndStatus(organizationId, WaitlistStatus.WAITING));
        stats.setTotalOffered(waitlistRepository.countByOrganizationIdAndStatus(organizationId, WaitlistStatus.OFFERED));
        stats.setTotalScheduled(waitlistRepository.countByOrganizationIdAndStatus(organizationId, WaitlistStatus.SCHEDULED));
        stats.setTotalDeclined(waitlistRepository.countByOrganizationIdAndStatus(organizationId, WaitlistStatus.DECLINED));
        stats.setTotalRemovedOrExpired(
                waitlistRepository.countByOrganizationIdAndStatus(organizationId, WaitlistStatus.REMOVED) +
                waitlistRepository.countByOrganizationIdAndStatus(organizationId, WaitlistStatus.EXPIRED));
        stats.setAvgTimeToOfferMinutes(-1); // Requires aggregation pipeline — wired in v2
        return stats;
    }

    // ── 10. Expiry Sweep (called by WaitlistExpiryScheduler) ─────────────────

    /**
     * Finds all OFFERED entries whose offer window has expired and re-queues them.
     * For each expired offer, the previously held slot is freed and offered to
     * the next WAITING patient.
     *
     * Pattern: Same as HomeCareVisitGenerationJob — scheduled sweep with no race conditions
     * because each document is updated atomically.
     */
    public void processExpiredOffers() {
        List<WaitlistEntry> expired = waitlistRepository.findByStatusAndOfferExpiresAtBefore(
                WaitlistStatus.OFFERED, Instant.now());

        if (expired.isEmpty()) {
            return;
        }

        log.info("[Waitlist] Processing {} expired offer(s).", expired.size());

        for (WaitlistEntry entry : expired) {
            String freedSlotId = entry.getOfferedSlotId();
            reQueueEntry(entry, "Offer expired without response");

            // Free the slot back to OPEN
            if (freedSlotId != null) {
                mongoTemplate.updateFirst(
                        Query.query(Criteria.where("id").is(freedSlotId)),
                        new Update().set("status", "OPEN").set("appointmentId", null),
                        AppointmentSlot.class);

                // Trigger offer to next patient
                offerNextSlot(entry.getOrganizationId(), entry.getFacilityId(), entry.getServiceType(), freedSlotId);
            }
        }
    }

    /**
     * Hook invoked by PatientScheduleService when an appointment is cancelled.
     * Resolves the serviceType from the freed slot and triggers waitlist offer.
     */
    public void handleAppointmentCancelled(Appointment cancelledAppt) {
        if (cancelledAppt == null || cancelledAppt.getSlotId() == null) {
            return;
        }

        AppointmentSlot slot = slotRepository.findById(cancelledAppt.getSlotId()).orElse(null);
        if (slot == null) {
            log.warn("[Waitlist] Cannot trigger waitlist offer — slot not found: {}", cancelledAppt.getSlotId());
            return;
        }

        // Resolve serviceType: use appointment type or fall back to "GENERAL"
        String serviceType = cancelledAppt.getAppointmentType() != null
                ? cancelledAppt.getAppointmentType().toUpperCase()
                : "GENERAL";

        log.info("[Waitlist] Appointment cancelled → triggering waitlist offer. facility={} serviceType={} slot={}",
                slot.getFacilityId(), serviceType, slot.getId());

        offerNextSlot(cancelledAppt.getOrganizationId(), slot.getFacilityId(), serviceType, slot.getId());
    }

    // ── Private Helpers ───────────────────────────────────────────────────────

    private WaitlistEntry getEntryOrThrow(String entryId) {
        return waitlistRepository.findById(entryId)
                .orElseThrow(() -> new ResourceNotFoundException("Waitlist entry not found: " + entryId));
    }

    private void assertSameOrg(String entryOrgId, String requestOrgId) {
        // ADMIN can skip org check (handled by AccessControlService.canAccessOrganization)
        User user = accessControlService.currentUser();
        if (user.getRole() == Role.ADMIN) {
            return;
        }
        if (!entryOrgId.equals(requestOrgId)) {
            throw new IllegalArgumentException("Access denied: cross-organization waitlist access is not allowed.");
        }
    }

    private void reQueueEntry(WaitlistEntry entry, String reason) {
        entry.setStatus(WaitlistStatus.WAITING);
        entry.setOfferedSlotId(null);
        entry.setOfferedAt(null);
        entry.setOfferExpiresAt(null);
        entry.setStatusUpdatedAt(Instant.now());
        waitlistRepository.save(entry);

        invalidateQueueCache(entry.getFacilityId(), entry.getServiceType());

        log.info("[Waitlist] Entry re-queued: entry={} patient={} reason={}", entry.getId(), entry.getPatientId(), reason);
    }

    private void invalidateQueueCache(String facilityId, String serviceType) {
        try {
            String cacheKey = queueCacheKey(facilityId, serviceType);
            redisTemplate.delete(cacheKey);
            log.debug("[Waitlist] Cache invalidated: key={}", cacheKey);
        } catch (Exception e) {
            log.warn("[Waitlist] Cache invalidation failed: {}", e.getMessage());
        }
    }

    /**
     * Sends a WebSocket notification to the patient + persists a Notification document.
     * Pattern: Same as FeedbackWebSocketController.notifyOtherPersonInRealTime
     */
    private void sendSlotOfferedNotification(WaitlistEntry entry) {
        // In-app Notification document
        sendNotification(entry.getPatientId(), "Appointment Slot Available!",
                "A slot has become available for " + entry.getServiceType() + ". You have 24 hours to respond.",
                "INFO", entry.getId());

        // WebSocket push — same pattern as FeedbackWebSocketController
        try {
            messagingTemplate.convertAndSendToUser(
                    entry.getPatientId(),
                    "/queue/notifications",
                    Map.of(
                            "type", "WAITLIST_OFFER",
                            "entryId", entry.getId(),
                            "facilityId", entry.getFacilityId(),
                            "serviceType", entry.getServiceType(),
                            "offeredSlotId", entry.getOfferedSlotId(),
                            "expiresAt", entry.getOfferExpiresAt() != null ? entry.getOfferExpiresAt().toString() : null,
                            "message", "A slot is now available for " + entry.getServiceType() + ". Accept or decline within 24 hours."
                    )
            );
            log.info("[Waitlist] WebSocket notification sent to patient={}", entry.getPatientId());
        } catch (Exception e) {
            log.warn("[Waitlist] WebSocket notification failed for patient={}: {}", entry.getPatientId(), e.getMessage());
        }
    }

    private void sendNotification(String recipientId, String title, String message, String type, String relatedEntityId) {
        try {
            Notification notif = new Notification();
            notif.setRecipientId(recipientId);
            notif.setTitle(title);
            notif.setMessage(message);
            notif.setType(type);
            notif.setRead(false);
            notif.setCreatedAt(LocalDateTime.now());
            notif.setRelatedEntityId(relatedEntityId);
            notif.setRelatedEntityType("WaitlistEntry");
            notificationRepository.save(notif);
        } catch (Exception e) {
            log.warn("[Waitlist] Notification save failed for recipient={}: {}", recipientId, e.getMessage());
        }
    }

    // ── Idempotency Helpers ───────────────────────────────────────────────────

    private String normalizeIdempotencyKey(String key) {
        if (key == null || key.isBlank()) return null;
        String normalized = key.trim();
        if (normalized.length() > 200) {
            throw new IllegalArgumentException("Idempotency-Key must be 200 characters or fewer");
        }
        return normalized;
    }

    private String idempotencyMarkerId(String userId, String key) {
        return userId + ":ADD_WAITLIST:" + key;
    }

    private IdempotencyRequest reserveIdempotencyMarker(String userId, String key) {
        String markerId = idempotencyMarkerId(userId, key);
        IdempotencyRequest marker = new IdempotencyRequest(
                markerId, userId, key, "ADD_WAITLIST", "PROCESSING",
                null, LocalDateTime.now(), LocalDateTime.now());
        try {
            return idempotencyRequestRepository.insert(marker);
        } catch (DuplicateKeyException ex) {
            IdempotencyRequest existing = idempotencyRequestRepository.findById(markerId)
                    .orElseThrow(() -> new IdempotencyInProgressException("Waitlist idempotent request is processing"));
            if ("COMPLETED".equals(existing.getStatus()) && existing.getResourceId() != null) {
                WaitlistEntry existingEntry = waitlistRepository.findById(existing.getResourceId())
                        .orElseThrow(() -> new ResourceNotFoundException("Idempotent waitlist entry not found: " + existing.getResourceId()));
                throw new CompletedIdempotencyException(mapToDTO(existingEntry));
            }
            throw new IdempotencyInProgressException("Waitlist request with this Idempotency-Key is still processing");
        }
    }

    private void completeIdempotencyMarker(IdempotencyRequest marker, String resourceId) {
        if (marker == null) return;
        marker.setStatus("COMPLETED");
        marker.setResourceId(resourceId);
        marker.setUpdatedAt(LocalDateTime.now());
        idempotencyRequestRepository.save(marker);
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    public WaitlistEntryDTO mapToDTO(WaitlistEntry entry) {
        WaitlistEntryDTO dto = new WaitlistEntryDTO();
        dto.setId(entry.getId());
        dto.setOrganizationId(entry.getOrganizationId());
        dto.setFacilityId(entry.getFacilityId());
        dto.setServiceType(entry.getServiceType());
        dto.setPatientId(entry.getPatientId());
        dto.setPatientName(entry.getPatientName());
        dto.setRequestedBy(entry.getRequestedBy());
        dto.setPriority(entry.getPriority());
        dto.setPriorityScore(entry.getPriorityScore());
        dto.setReasonForVisit(entry.getReasonForVisit());
        dto.setStatus(entry.getStatus());
        dto.setCreatedAt(entry.getCreatedAt());
        dto.setOfferedAt(entry.getOfferedAt());
        dto.setOfferExpiresAt(entry.getOfferExpiresAt());
        dto.setOfferedSlotId(entry.getOfferedSlotId());
        dto.setScheduledAppointmentId(entry.getScheduledAppointmentId());
        dto.setStatusUpdatedAt(entry.getStatusUpdatedAt());
        dto.setNotes(entry.getNotes());
        dto.setVersion(entry.getVersion());
        return dto;
    }

    public List<WaitlistEntryDTO> getEntriesByPatientId(String patientId, String organizationId) {
        List<WaitlistEntry> entries = waitlistRepository.findByPatientIdAndOrganizationId(patientId, organizationId);
        return entries.stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    private ObjectMapper buildObjectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        return mapper;
    }

    // ── Inner: Completed Idempotency Exception ────────────────────────────────

    static class CompletedIdempotencyException extends RuntimeException {
        private final WaitlistEntryDTO dto;
        CompletedIdempotencyException(WaitlistEntryDTO dto) { this.dto = dto; }
        WaitlistEntryDTO getDto() { return dto; }
    }
}
