package com.healthcare.epcr.scheduling.service;

import com.healthcare.epcr.scheduling.model.Appointment;
import com.healthcare.epcr.scheduling.model.AppointmentSlot;
import com.healthcare.epcr.scheduling.model.ProviderScheduleTemplate;
import com.healthcare.epcr.scheduling.model.TravelBundle;
import com.healthcare.epcr.scheduling.repository.AppointmentRepository;
import com.healthcare.epcr.scheduling.repository.AppointmentSlotRepository;
import com.healthcare.epcr.scheduling.repository.ProviderScheduleTemplateRepository;
import com.healthcare.epcr.scheduling.repository.TravelBundleRepository;
import com.healthcare.epcr.user.repository.UserRepository;
import com.healthcare.epcr.patient.repository.PatientRepository;
import com.healthcare.epcr.patient.model.Patient;
import com.healthcare.epcr.security.AccessControlService;
import com.healthcare.epcr.patient.service.PatientAdminService;
import com.healthcare.epcr.patient.dto.PatientSearchResultDTO;
import com.healthcare.epcr.notification.repository.NotificationRepository;
import com.healthcare.epcr.notification.model.Notification;
import com.healthcare.epcr.notification.service.EmailService;
import com.healthcare.epcr.user.model.User;
import com.healthcare.epcr.user.model.Role;
import com.healthcare.epcr.waitlist.service.WaitlistService;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class PatientScheduleService {

    private final AppointmentRepository appointmentRepository;
    private final AppointmentSlotRepository slotRepository;
    private final ProviderScheduleTemplateRepository templateRepository;
    private final TravelBundleRepository travelBundleRepository;
    private final MongoTemplate mongoTemplate;
    private final UserRepository userRepository;
    private final PatientRepository patientRepository;
    private final NotificationRepository notificationRepository;
    private final AccessControlService accessControlService;
    private final PatientAdminService patientAdminService;
    private final EmailService emailService;

    /**
     * @Lazy: Breaks the potential circular dependency chain
     * (PatientScheduleService → WaitlistService → AppointmentRepository → PatientScheduleService).
     * WaitlistService is injected lazily so it is only resolved on first use (first cancellation).
     */
    @Lazy
    @Autowired
    private WaitlistService waitlistService;

    // ── SLOT QUERIES (Org-scoped) ─────────────────────────────────────────────

    /**
     * Returns slots for a given date, scoped by org.
     * ADMIN sees everything; MANAGER/PARAMEDIC/PHYSICIAN see only their org.
     * Optional providerId filter narrows results to a specific doctor.
     */
    public List<AppointmentSlot> getSlotsForDate(
            String organizationId, boolean isAdmin,
            String providerId, String date) {

        try {
            slotRepository.deleteByStatusAndSlotStartBefore("OPEN", Instant.now());
        } catch (Exception e) {
            log.error("Failed to delete expired open slots in getSlotsForDate: {}", e.getMessage());
        }

        LocalDate d = LocalDate.parse(date);
        Instant start = d.atStartOfDay(ZoneId.systemDefault()).toInstant();
        Instant end   = d.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant();

        if (isAdmin) {
            // Admin: no org filter
            if (providerId != null && !providerId.isBlank()) {
                return slotRepository.findByProviderIdAndStatusAndSlotStartBetween(
                        providerId, "OPEN", start, end);
            }
            // Admin with no provider filter — return all open slots that day
            // (use a MongoTemplate query for flexibility)
            Query q = Query.query(Criteria.where("slotStart").gte(start).lt(end));
            return mongoTemplate.find(q, AppointmentSlot.class);
        }

        // Non-admin: always scope to their org
        if (providerId != null && !providerId.isBlank()) {
            return slotRepository.findByProviderIdAndOrganizationIdAndSlotStartBetween(
                    providerId, organizationId, start, end);
        }
        return slotRepository.findByOrganizationIdAndSlotStartBetween(
                organizationId, start, end);
    }

    // ── BOOKING (Atomic) ──────────────────────────────────────────────────────

    public Appointment bookSlot(String slotId, String patientId, String patientName,
                                String organizationId, String reason, String idempotencyKey) {
        // 1. Idempotency check — same key returns same result
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            Optional<Appointment> existing = appointmentRepository.findByIdempotencyKey(idempotencyKey);
            if (existing.isPresent()) {
                log.info("Duplicate request detected for idempotencyKey: {}. Returning existing appointment.", idempotencyKey);
                return existing.get();
            }
        }

        // 2. Atomic Slot Booking — findAndModify: status OPEN → BOOKED
        Query query  = Query.query(Criteria.where("id").is(slotId).and("status").is("OPEN"));
        Update update = new Update().set("status", "BOOKED");
        AppointmentSlot slot = mongoTemplate.findAndModify(query, update,
                FindAndModifyOptions.options().returnNew(true), AppointmentSlot.class);

        if (slot == null) {
            throw new IllegalArgumentException("Slot is no longer available (already booked or does not exist).");
        }

        // 3. Create Appointment Document
        Appointment appt = new Appointment();
        appt.setSlotId(slot.getId());
        appt.setPatientId(patientId);

        String resolvedPatientName = patientId;
        try {
            PatientSearchResultDTO pDto = patientAdminService.getPatientById(patientId);
            if (pDto != null) {
                resolvedPatientName = (pDto.getDisplayName() != null && !pDto.getDisplayName().isBlank())
                        ? pDto.getDisplayName() : pDto.getPatientName();
            }
        } catch (Exception e) {
            log.error("Failed to decrypt patient name: {}", e.getMessage());
        }

        if ((resolvedPatientName == null || resolvedPatientName.equals(patientId)) 
                && patientName != null && !patientName.isBlank() && !patientName.equals(patientId)) {
            resolvedPatientName = patientName;
        }

        appt.setPatientName(resolvedPatientName);
        
        Patient pOpt = patientRepository.findByPatientId(patientId).orElse(null);
        if (pOpt != null) {
            appt.setPatientPhone(pOpt.getPhone());
        }
        
        appt.setProviderId(slot.getProviderId());
        
        com.healthcare.epcr.user.model.User doc = userRepository.findById(slot.getProviderId()).orElse(null);
        if (doc != null) {
            appt.setProviderName("Dr. " + doc.getFirstName() + " " + doc.getLastName());
        } else {
            appt.setProviderName("Doctor (" + slot.getProviderId() + ")");
        }
        
        appt.setAppointmentType("General");
        appt.setOrganizationId(organizationId);
        appt.setFacilityId(slot.getFacilityId());
        appt.setScheduledStart(slot.getSlotStart());
        appt.setScheduledEnd(slot.getSlotEnd());
        appt.setReasonForVisit(reason);
        appt.setStatus("SCHEDULED");
        appt.setIdempotencyKey(idempotencyKey);
        appt.setCreatedAt(Instant.now());
        appt.setUpdatedAt(Instant.now());
        appt = appointmentRepository.save(appt);

        // 4. Link slot → appointment
        mongoTemplate.updateFirst(
                Query.query(Criteria.where("id").is(slot.getId())),
                Update.update("appointmentId", appt.getId()),
                AppointmentSlot.class);

        // 5. Send In-App Notifications
        try {
            User initiator = accessControlService.currentUser();
            String patientDisplayName = appt.getPatientName();
            String docName = appt.getProviderName() != null ? appt.getProviderName() : "Doctor";
            String slotTimeStr = slot.getSlotStart() != null ? slot.getSlotStart().toString() : "scheduled time";

            try {
                if (slot.getSlotStart() != null) {
                    slotTimeStr = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")
                            .withZone(ZoneId.systemDefault())
                            .format(slot.getSlotStart());
                }
            } catch (Exception ignored) {}

            String msgForDoctor;
            String msgForInitiator;

            if (initiator != null && initiator.getRole() != Role.PATIENT) {
                msgForDoctor = String.format("%s %s booked an appointment for patient %s with you on %s for reason: %s.",
                        initiator.getRole(),
                        initiator.getFirstName() + " " + initiator.getLastName(),
                        patientDisplayName, slotTimeStr, reason);
                msgForInitiator = String.format("You successfully scheduled patient %s with %s on %s.",
                        patientDisplayName, docName, slotTimeStr);
            } else {
                msgForDoctor = String.format("Patient %s has booked an appointment with you on %s for reason: %s.",
                        patientDisplayName, slotTimeStr, reason);
                msgForInitiator = String.format("Your appointment with %s has been successfully booked for %s.",
                        docName, slotTimeStr);
            }

            // A. Create notification for Doctor
            Notification docNotif = new Notification();
            docNotif.setRecipientId(appt.getProviderId());
            docNotif.setType("INFO");
            docNotif.setTitle("New Appointment Scheduled");
            docNotif.setMessage(msgForDoctor);
            docNotif.setRead(false);
            docNotif.setCreatedAt(LocalDateTime.now());
            docNotif.setRelatedEntityId(appt.getId());
            docNotif.setRelatedEntityType("Appointment");
            notificationRepository.save(docNotif);

            if (doc != null && doc.getEmail() != null && !doc.getEmail().isBlank()) {
                String emailBody = String.format("<html><body><h3>New Appointment Scheduled</h3><p>%s</p></body></html>", msgForDoctor);
                emailService.sendEmail(doc.getEmail(), "New Appointment Scheduled", emailBody);
            }
 
            // B. Create notification for Initiator (if staff)
            if (initiator != null && initiator.getRole() != Role.PATIENT) {
                Notification staffNotif = new Notification();
                staffNotif.setRecipientId(initiator.getId());
                staffNotif.setType("SUCCESS");
                staffNotif.setTitle("Booking Confirmed");
                staffNotif.setMessage(msgForInitiator);
                staffNotif.setRead(false);
                staffNotif.setCreatedAt(LocalDateTime.now());
                staffNotif.setRelatedEntityId(appt.getId());
                staffNotif.setRelatedEntityType("Appointment");
                notificationRepository.save(staffNotif);

                if (initiator.getEmail() != null && !initiator.getEmail().isBlank()) {
                    String emailBody = String.format("<html><body><h3>Booking Confirmed</h3><p>%s</p></body></html>", msgForInitiator);
                    emailService.sendEmail(initiator.getEmail(), "Booking Confirmed", emailBody);
                }
            }
 
            // C. Create notification for Patient
            Notification patNotif = new Notification();
            patNotif.setRecipientId(appt.getPatientId());
            patNotif.setType("SUCCESS");
            patNotif.setTitle("Appointment Confirmed");
            if (initiator != null && initiator.getRole() != Role.PATIENT) {
                patNotif.setMessage(String.format("%s %s has booked an appointment for you with %s on %s for reason: %s.",
                        initiator.getRole(),
                        initiator.getFirstName() + " " + initiator.getLastName(),
                        docName, slotTimeStr, reason));
            } else {
                patNotif.setMessage(String.format("You successfully scheduled your appointment with %s on %s for reason: %s.",
                        docName, slotTimeStr, reason));
            }
            patNotif.setRead(false);
            patNotif.setCreatedAt(LocalDateTime.now());
            patNotif.setRelatedEntityId(appt.getId());
            patNotif.setRelatedEntityType("Appointment");
            notificationRepository.save(patNotif);

            if (pOpt != null && pOpt.getEmail() != null && !pOpt.getEmail().isBlank()) {
                String emailBody = String.format("<html><body><h3>Appointment Confirmed</h3><p>%s</p></body></html>", patNotif.getMessage());
                emailService.sendEmail(pOpt.getEmail(), "Appointment Confirmed", emailBody);
            }
        } catch (Exception e) {
            log.error("Failed to create notifications for booking slot: {}", e.getMessage());
        }

        log.info("Booked slot {} for patient {} → appointment {}", slotId, patientId, appt.getId());
        return appt;
    }

    // ── RESCHEDULE ────────────────────────────────────────────────────────────

    @Transactional
    public Appointment reschedule(String appointmentId, String newSlotId) {
        Appointment appt = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new IllegalArgumentException("Appointment not found: " + appointmentId));

        // Release old slot
        mongoTemplate.updateFirst(
                Query.query(Criteria.where("id").is(appt.getSlotId())),
                new Update().set("status", "OPEN").set("appointmentId", null),
                AppointmentSlot.class);

        // Book new slot atomically
        Appointment newAppt = bookSlot(newSlotId, appt.getPatientId(), "Patient",
                appt.getOrganizationId(), appt.getReasonForVisit(), UUID.randomUUID().toString());

        // Cancel old appointment record
        appt.setStatus("CANCELLED");
        appt.setUpdatedAt(Instant.now());
        appointmentRepository.save(appt);

        log.info("Rescheduled appointment {} → new appointment {}", appointmentId, newAppt.getId());
        return newAppt;
    }

    // ── CANCEL ────────────────────────────────────────────────────────────────

    public Appointment cancelAppointment(String appointmentId) {
        Appointment appt = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new IllegalArgumentException("Appointment not found: " + appointmentId));

        // Free the slot back to OPEN
        mongoTemplate.updateFirst(
                Query.query(Criteria.where("id").is(appt.getSlotId())),
                new Update().set("status", "OPEN").set("appointmentId", null),
                AppointmentSlot.class);

        appt.setStatus("CANCELLED");
        appt.setUpdatedAt(Instant.now());
        Appointment savedAppt = appointmentRepository.save(appt);

        // Send Cancellation In-App and Email Notifications
        try {
            String patientDisplayName = savedAppt.getPatientName();
            String docName = savedAppt.getProviderName() != null ? savedAppt.getProviderName() : "Doctor";
            String slotTimeStr = savedAppt.getScheduledStart() != null ? savedAppt.getScheduledStart().toString() : "scheduled time";

            try {
                if (savedAppt.getScheduledStart() != null) {
                    slotTimeStr = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")
                            .withZone(ZoneId.systemDefault())
                            .format(savedAppt.getScheduledStart());
                }
            } catch (Exception ignored) {}

            String msgForDoctor = String.format("Appointment with patient %s on %s has been CANCELLED.",
                    patientDisplayName, slotTimeStr);
            String msgForPatient = String.format("Your appointment with %s on %s has been CANCELLED.",
                    docName, slotTimeStr);

            // A. Create notification for Doctor
            Notification docNotif = new Notification();
            docNotif.setRecipientId(savedAppt.getProviderId());
            docNotif.setType("WARNING");
            docNotif.setTitle("Appointment Cancelled");
            docNotif.setMessage(msgForDoctor);
            docNotif.setRead(false);
            docNotif.setCreatedAt(LocalDateTime.now());
            docNotif.setRelatedEntityId(savedAppt.getId());
            docNotif.setRelatedEntityType("Appointment");
            notificationRepository.save(docNotif);

            User doc = userRepository.findById(savedAppt.getProviderId()).orElse(null);
            if (doc != null && doc.getEmail() != null && !doc.getEmail().isBlank()) {
                String emailBody = String.format("<html><body><h3>Appointment Cancelled</h3><p>%s</p></body></html>", msgForDoctor);
                emailService.sendEmail(doc.getEmail(), "Appointment Cancelled", emailBody);
            }

            // B. Create notification for Patient
            Notification patNotif = new Notification();
            patNotif.setRecipientId(savedAppt.getPatientId());
            patNotif.setType("WARNING");
            patNotif.setTitle("Appointment Cancelled");
            patNotif.setMessage(msgForPatient);
            patNotif.setRead(false);
            patNotif.setCreatedAt(LocalDateTime.now());
            patNotif.setRelatedEntityId(savedAppt.getId());
            patNotif.setRelatedEntityType("Appointment");
            notificationRepository.save(patNotif);

            Patient pOpt = patientRepository.findByPatientId(savedAppt.getPatientId()).orElse(null);
            if (pOpt != null && pOpt.getEmail() != null && !pOpt.getEmail().isBlank()) {
                String emailBody = String.format("<html><body><h3>Appointment Cancelled</h3><p>%s</p></body></html>", msgForPatient);
                emailService.sendEmail(pOpt.getEmail(), "Appointment Cancelled", emailBody);
            }
        } catch (Exception e) {
            log.error("Failed to create cancellation notifications: {}", e.getMessage());
        }

        // Trigger waitlist slot offering — when a slot opens up, offer it to the
        // next WAITING patient. Uses atomic findAndModify in WaitlistService.
        triggerWaitlistForCancelledSlot(savedAppt);

        return savedAppt;
    }

    // ── WAITLIST HOOK ─────────────────────────────────────────────────────────

    /**
     * Triggers waitlist offer after any appointment cancellation.
     * Called at the very end of cancelAppointment to ensure the slot is freed first.
     * Delegates to WaitlistService.handleAppointmentCancelled which resolves the
     * serviceType from the appointment and runs the atomic findAndModify offer.
     *
     * @Lazy-injected WaitlistService avoids circular dependency issues.
     */
    private void triggerWaitlistForCancelledSlot(Appointment cancelledAppt) {
        try {
            if (waitlistService != null) {
                waitlistService.handleAppointmentCancelled(cancelledAppt);
            }
        } catch (Exception e) {
            // Waitlist trigger failure must NOT block the cancellation response
            log.warn("[Waitlist] Failed to trigger waitlist offer after appointment cancellation: {}", e.getMessage());
        }
    }

    // ── BULK HOLIDAY BLOCK ────────────────────────────────────────────────────

    /**
     * Blocks all OPEN slots for a provider within a date range.
     * Used when a doctor goes on holiday. Only affects the requesting org.
     * Returns the count of slots blocked.
     */
    public int bulkBlockSlots(String organizationId, String providerId,
                              String fromDate, String toDate, String reason) {
        LocalDate from = LocalDate.parse(fromDate);
        LocalDate to   = LocalDate.parse(toDate);

        if (to.isBefore(from)) {
            throw new IllegalArgumentException("toDate must be on or after fromDate.");
        }

        Instant start = from.atStartOfDay(ZoneId.systemDefault()).toInstant();
        Instant end   = to.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant();

        // Fetch all OPEN slots for this provider in the org within the range
        List<AppointmentSlot> openSlots = slotRepository
                .findByOrganizationIdAndProviderIdAndStatusAndSlotStartBetween(
                        organizationId, providerId, "OPEN", start, end);

        if (openSlots.isEmpty()) {
            log.info("No OPEN slots found for provider {} between {} and {} in org {}",
                    providerId, fromDate, toDate, organizationId);
            return 0;
        }

        // Bulk update status → BLOCKED
        List<String> slotIds = openSlots.stream().map(AppointmentSlot::getId).toList();
        Query q = Query.query(Criteria.where("id").in(slotIds));
        Update u = new Update()
                .set("status", "BLOCKED")
                .set("blockReason", reason != null ? reason : "Provider unavailable");

        long modified = mongoTemplate.updateMulti(q, u, AppointmentSlot.class).getModifiedCount();

        // Also add the dates as exceptionDates on the provider's templates
        // so future slot generation won't recreate slots during this period
        List<ProviderScheduleTemplate> templates = templateRepository.findByProviderIdAndActiveTrue(providerId);
        for (ProviderScheduleTemplate tpl : templates) {
            if (!tpl.getOrganizationId().equals(organizationId)) continue;
            List<java.time.LocalDate> exceptions = tpl.getExceptionDates() != null
                    ? new java.util.ArrayList<>(tpl.getExceptionDates())
                    : new java.util.ArrayList<>();
            // Add every date in the range to exception list
            for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
                if (!exceptions.contains(d)) exceptions.add(d);
            }
            tpl.setExceptionDates(exceptions);
            templateRepository.save(tpl);
        }

        log.info("Bulk-blocked {} slots for provider {} from {} to {} (reason: {})",
                modified, providerId, fromDate, toDate, reason);
        return (int) modified;
    }

    /**
     * Unblock slots — restore BLOCKED → OPEN for a date range.
     * Also removes those dates from the template exceptionDates list.
     */
    public int bulkUnblockSlots(String organizationId, String providerId,
                                String fromDate, String toDate) {
        LocalDate from = LocalDate.parse(fromDate);
        LocalDate to   = LocalDate.parse(toDate);

        Instant start = from.atStartOfDay(ZoneId.systemDefault()).toInstant();
        Instant end   = to.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant();

        // Fetch BLOCKED slots
        Query q = Query.query(Criteria.where("organizationId").is(organizationId)
                .and("providerId").is(providerId)
                .and("status").is("BLOCKED")
                .and("slotStart").gte(start).lt(end));

        List<AppointmentSlot> blocked = mongoTemplate.find(q, AppointmentSlot.class);
        if (blocked.isEmpty()) return 0;

        List<String> slotIds = blocked.stream().map(AppointmentSlot::getId).toList();
        Query updateQ = Query.query(Criteria.where("id").in(slotIds));
        long modified = mongoTemplate.updateMulti(updateQ,
                new Update().set("status", "OPEN").unset("blockReason"),
                AppointmentSlot.class).getModifiedCount();

        // Remove from template exceptionDates
        List<ProviderScheduleTemplate> templates = templateRepository.findByProviderIdAndActiveTrue(providerId);
        for (ProviderScheduleTemplate tpl : templates) {
            if (!tpl.getOrganizationId().equals(organizationId)) continue;
            if (tpl.getExceptionDates() == null) continue;
            List<LocalDate> exceptions = new java.util.ArrayList<>(tpl.getExceptionDates());
            for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
                exceptions.remove(d);
            }
            tpl.setExceptionDates(exceptions);
            templateRepository.save(tpl);
        }

        log.info("Unblocked {} slots for provider {} from {} to {}", modified, providerId, fromDate, toDate);
        return (int) modified;
    }

    // ── STATS ─────────────────────────────────────────────────────────────────

    /**
     * Returns scheduling statistics for the dashboard stats row.
     * Admin sees global counts; others see their org only.
     */
    public java.util.Map<String, Object> getStats(String organizationId, boolean isAdmin) {
        Instant todayStart = LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant();
        Instant todayEnd   = LocalDate.now().plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant();

        long openSlots, bookedToday, travelBundles, reminders;

        if (isAdmin) {
            Query qOpen = Query.query(Criteria.where("status").is("OPEN")
                    .and("slotStart").gte(todayStart).lt(todayEnd));
            openSlots = mongoTemplate.count(qOpen, AppointmentSlot.class);

            Query qBooked = Query.query(Criteria.where("status").is("SCHEDULED")
                    .and("scheduledStart").gte(todayStart).lt(todayEnd));
            bookedToday = mongoTemplate.count(qBooked, Appointment.class);

            travelBundles = travelBundleRepository.count();

            Query qReminders = Query.query(Criteria.where("status").is("SCHEDULED")
                    .and("reminderSent").is(false));
            reminders = mongoTemplate.count(qReminders, Appointment.class);
        } else {
            openSlots = slotRepository.countByOrganizationIdAndStatusAndSlotStartBetween(
                    organizationId, "OPEN", todayStart, todayEnd);
            bookedToday = appointmentRepository
                    .countByOrganizationIdAndStatusAndScheduledStartBetween(
                            organizationId, "SCHEDULED", todayStart, todayEnd);
            travelBundles = travelBundleRepository.countByOrganizationId(organizationId);
            reminders = appointmentRepository
                    .countByOrganizationIdAndReminderSentFalseAndStatus(organizationId, "SCHEDULED");
        }

        return java.util.Map.of(
                "openSlots",     openSlots,
                "bookedToday",   bookedToday,
                "travelBundles", travelBundles,
                "reminders",     reminders
        );
    }

    // ── TRAVEL BUNDLES ────────────────────────────────────────────────────────

    public TravelBundle createTravelBundle(TravelBundle bundle) {
        bundle.setStatus("PLANNED");
        return travelBundleRepository.save(bundle);
    }

    public Optional<String> suggestTravelBundle(String patientId, String destinationFacilityId, Instant slotStart) {
        // Check existing planned travel bundles to same destination
        List<TravelBundle> activeBundles = travelBundleRepository
                .findByPatientIdAndDestinationFacilityIdAndStatus(patientId, destinationFacilityId, "PLANNED");

        if (!activeBundles.isEmpty()) {
            TravelBundle b = activeBundles.get(0);
            return Optional.of("Patient has an existing planned travel bundle to this hub on "
                    + b.getTravelDate() + ". Bundle this new appointment? Ref: " + b.getId());
        }

        // Check for nearby existing appointments at same facility (±2 days)
        LocalDate targetDate = slotStart.atZone(ZoneId.systemDefault()).toLocalDate();
        List<Appointment> allAppts = appointmentRepository.findByPatientId(patientId);

        for (Appointment a : allAppts) {
            if ("SCHEDULED".equalsIgnoreCase(a.getStatus())
                    && destinationFacilityId.equalsIgnoreCase(a.getFacilityId())) {
                LocalDate apptDate = a.getScheduledStart().atZone(ZoneId.systemDefault()).toLocalDate();
                long days = Math.abs(ChronoUnit.DAYS.between(targetDate, apptDate));
                if (days <= 2 && a.getTravelBundleId() == null) {
                    return Optional.of("Patient has another appointment at this facility on " + apptDate
                            + " (ID: " + a.getId() + "). Recommend creating a Travel Bundle.");
                }
            }
        }
        return Optional.empty();
    }
}
