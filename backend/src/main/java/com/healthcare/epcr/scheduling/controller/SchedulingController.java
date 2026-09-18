package com.healthcare.epcr.scheduling.controller;

import com.healthcare.epcr.scheduling.model.Appointment;
import com.healthcare.epcr.scheduling.model.AppointmentSlot;
import com.healthcare.epcr.scheduling.model.ProviderScheduleTemplate;
import com.healthcare.epcr.scheduling.model.TravelBundle;
import com.healthcare.epcr.scheduling.repository.AppointmentRepository;
import com.healthcare.epcr.scheduling.repository.AppointmentSlotRepository;
import com.healthcare.epcr.scheduling.repository.ProviderScheduleTemplateRepository;
import com.healthcare.epcr.scheduling.repository.TravelBundleRepository;
import com.healthcare.epcr.scheduling.scheduler.SlotGenerationJob;
import com.healthcare.epcr.patient.repository.PatientRepository;
import com.healthcare.epcr.patient.model.Patient;
import com.healthcare.epcr.patient.service.PatientAdminService;
import com.healthcare.epcr.patient.dto.PatientSearchResultDTO;
import com.healthcare.epcr.scheduling.service.PatientScheduleService;
import com.healthcare.epcr.security.session.cache.CachedAuthSession;
import com.healthcare.epcr.patient.security.PatientPrincipal;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import com.healthcare.epcr.user.repository.UserRepository;
import com.healthcare.epcr.user.model.Role;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/scheduling")
@RequiredArgsConstructor
public class SchedulingController {

    private final PatientScheduleService scheduleService;
    private final ProviderScheduleTemplateRepository templateRepository;
    private final AppointmentSlotRepository slotRepository;
    private final AppointmentRepository appointmentRepository;
    private final TravelBundleRepository travelBundleRepository;
    private final SlotGenerationJob slotGenerationJob;
    private final UserRepository userRepository;
    private final PatientRepository patientRepository;
    private final PatientAdminService patientAdminService;

    // ══════════════════════════════════════════════════════════════════════════
    // PROVIDERS LOOKUP — so staff don't need to know internal IDs
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * GET /api/scheduling/providers
     * Returns active Physicians and Paramedics for the calendar / template picker.
     * ADMIN → all orgs | MANAGER → own org only
     */
    @GetMapping("/providers")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'QA_REVIEWER', 'PATIENT')")
    public ResponseEntity<?> getProviders(Authentication auth) {
        try {
            String orgId = null;
            boolean isAdmin = false;

            if (auth != null && auth.getPrincipal() instanceof PatientPrincipal pp) {
                orgId = pp.organizationId();
            } else {
                CachedAuthSession session = getSession(auth);
                orgId = session.getOrganizationId();
                isAdmin = hasRole(auth, "ADMIN");
            }

            List<com.healthcare.epcr.user.model.User> users;
            if (isAdmin) {
                // Admin sees all active physicians across all orgs
                users = userRepository.findAll();
            } else {
                // Staff and patients see only physicians in their own org
                users = userRepository.findByOrganizationIdAndRole(orgId, Role.PHYSICIAN);
            }

            List<Map<String, Object>> providers = users.stream()
                    // Provider = Doctor (PHYSICIAN only)
                    .filter(u -> u.getRole() == Role.PHYSICIAN)
                    .filter(u -> Boolean.TRUE.equals(u.getActive()))
                    .map(u -> Map.<String, Object>of(
                            "id",        u.getId(),
                            "fullName",  trim(u.getFirstName()) + " " + trim(u.getLastName()),
                            "firstName", trim(u.getFirstName()),
                            "lastName",  trim(u.getLastName()),
                            "email",     trim(u.getEmail()),
                            "role",      u.getRole().name(),
                            "orgId",     trim(u.getOrganizationId())
                    ))
                    .collect(Collectors.toList());

            return ResponseEntity.ok(providers);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to load providers: " + e.getMessage()));
        }
    }

    private static String trim(String s) { return s != null ? s.trim() : ""; }

    // ══════════════════════════════════════════════════════════════════════════
    // TEMPLATES
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * GET /api/scheduling/templates
     * ADMIN → all templates across all orgs
     * MANAGER → only their org's templates
     */
    @GetMapping("/templates")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<List<ProviderScheduleTemplate>> getTemplates(Authentication auth) {
        try {
            CachedAuthSession session = getSession(auth);
            boolean isAdmin = hasRole(auth, "ADMIN");
            // Only return ACTIVE templates — soft-deleted ones are excluded
            List<ProviderScheduleTemplate> templates = isAdmin
                    ? templateRepository.findByActiveTrue()
                    : templateRepository.findByOrganizationIdAndActiveTrue(session.getOrganizationId());
            return ResponseEntity.ok(templates);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * POST /api/scheduling/templates
     * Creates a schedule template. orgId is auto-injected from the JWT session.
     */
    @PostMapping("/templates")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<?> createTemplate(
            @RequestBody ProviderScheduleTemplate template,
            Authentication auth) {
        try {
            CachedAuthSession session = getSession(auth);
            boolean isAdmin = hasRole(auth, "ADMIN");
            if (!isAdmin || template.getOrganizationId() == null || template.getOrganizationId().isBlank()) {
                template.setOrganizationId(session.getOrganizationId());
            }
            template.setActive(true);
            return ResponseEntity.status(HttpStatus.CREATED).body(templateRepository.save(template));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * PUT /api/scheduling/templates/{id}
     * Updates an existing template. Manager can only update their org's template.
     */
    @PutMapping("/templates/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<?> updateTemplate(
            @PathVariable String id,
            @RequestBody ProviderScheduleTemplate updated,
            Authentication auth) {
        try {
            CachedAuthSession session = getSession(auth);
            ProviderScheduleTemplate existing = templateRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("Template not found: " + id));

            // Manager can only edit their own org
            if (!hasRole(auth, "ADMIN")
                    && !existing.getOrganizationId().equals(session.getOrganizationId())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "Access denied: template belongs to a different organization."));
            }

            // Preserve immutable fields
            updated.setId(id);
            updated.setOrganizationId(existing.getOrganizationId());
            return ResponseEntity.ok(templateRepository.save(updated));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * DELETE /api/scheduling/templates/{id}
     * Deactivates (soft-delete) a template. Manager can only delete their org's.
     */
    @DeleteMapping("/templates/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<?> deleteTemplate(@PathVariable String id, Authentication auth) {
        try {
            CachedAuthSession session = getSession(auth);
            ProviderScheduleTemplate existing = templateRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("Template not found: " + id));

            if (!hasRole(auth, "ADMIN")
                    && !existing.getOrganizationId().equals(session.getOrganizationId())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "Access denied."));
            }

            // Soft-delete: mark inactive instead of hard delete
            existing.setActive(false);
            templateRepository.save(existing);
            return ResponseEntity.ok(Map.of("message", "Template deactivated successfully."));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * POST /api/scheduling/templates/{id}/generate
     * Manually generate slots for a specific template over a date range.
     */
    @PostMapping("/templates/{id}/generate")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<?> generateFromTemplate(
            @PathVariable String id,
            @RequestBody GenerateRequest req,
            Authentication auth) {
        try {
            CachedAuthSession session = getSession(auth);
            ProviderScheduleTemplate template = templateRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("Template not found: " + id));

            if (!hasRole(auth, "ADMIN")
                    && !template.getOrganizationId().equals(session.getOrganizationId())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "Access denied."));
            }

            int count = slotGenerationJob.generateSlotsForTemplate(template,
                    LocalDate.parse(req.getStartDate()), LocalDate.parse(req.getEndDate()));
            return ResponseEntity.ok(Map.of(
                    "message", "Slot generation complete.",
                    "count", count));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // SLOTS
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * GET /api/scheduling/slots?date=YYYY-MM-DD&providerId=xxx (optional)
     * ADMIN   → all slots for that day (no org filter)
     * MANAGER/PARAMEDIC/PHYSICIAN → scoped to their org
     */
    @GetMapping("/slots")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'QA_REVIEWER', 'PATIENT')")
    public ResponseEntity<?> getSlots(
            @RequestParam String date,
            @RequestParam(required = false) String providerId,
            Authentication auth) {
        try {
            String orgId = null;
            boolean isAdmin = false;
            if (auth != null && auth.getPrincipal() instanceof PatientPrincipal pp) {
                orgId = pp.organizationId();
            } else {
                CachedAuthSession session = getSession(auth);
                orgId = session.getOrganizationId();
                isAdmin = hasRole(auth, "ADMIN");
            }
            List<AppointmentSlot> slots = scheduleService.getSlotsForDate(
                    orgId, isAdmin, providerId, date);
            return ResponseEntity.ok(slots);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * PATCH /api/scheduling/slots/{id}/cancel
     * Single slot cancel → status OPEN (unbook) or BLOCKED (block).
     */
    @PatchMapping("/slots/{id}/cancel")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<?> cancelSlot(@PathVariable String id) {
        try {
            AppointmentSlot slot = slotRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("Slot not found: " + id));
            slot.setStatus("BLOCKED");
            slot.setBlockReason("Manually blocked by staff");
            return ResponseEntity.ok(slotRepository.save(slot));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * POST /api/scheduling/slots/{id}/book
     * Books a single slot for a patient (PARAMEDIC / PHYSICIAN / ADMIN / MANAGER).
     * Requires Idempotency-Key header.
     */
    @PostMapping("/slots/{id}/book")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'PATIENT')")
    public ResponseEntity<?> bookSlot(
            @PathVariable String id,
            @RequestBody BookSlotRequest req,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            Authentication auth) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            // Auto-generate if not provided (convenience for UI calls)
            idempotencyKey = java.util.UUID.randomUUID().toString();
        }
        try {
            String orgId = null;
            if (auth != null && auth.getPrincipal() instanceof PatientPrincipal pp) {
                orgId = pp.organizationId();
            } else {
                CachedAuthSession session = getSession(auth);
                orgId = session.getOrganizationId();
            }
            Appointment appt = scheduleService.bookSlot(
                    id,
                    req.getPatientId(),
                    req.getPatientName() != null ? req.getPatientName() : req.getPatientId(),
                    orgId,
                    req.getNotes(),
                    idempotencyKey);
            return ResponseEntity.status(HttpStatus.CREATED).body(appt);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // HOLIDAY / BULK BLOCK
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * POST /api/scheduling/slots/bulk-block
     * Blocks all OPEN slots for a provider within a date range.
     * Also patches the provider's schedule templates to add exceptionDates.
     * ADMIN → any org; MANAGER → only their org.
     */
    @PostMapping("/slots/bulk-block")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<?> bulkBlockSlots(
            @RequestBody BulkBlockRequest req,
            Authentication auth) {
        try {
            CachedAuthSession session = getSession(auth);
            String orgId = hasRole(auth, "ADMIN") && req.getOrganizationId() != null
                    ? req.getOrganizationId()
                    : session.getOrganizationId();

            int count = scheduleService.bulkBlockSlots(
                    orgId, req.getProviderId(),
                    req.getFromDate(), req.getToDate(),
                    req.getReason());

            return ResponseEntity.ok(Map.of(
                    "message", count + " slot(s) blocked successfully.",
                    "blockedCount", count,
                    "providerId", req.getProviderId(),
                    "from", req.getFromDate(),
                    "to", req.getToDate()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * POST /api/scheduling/slots/bulk-unblock
     * Restores BLOCKED → OPEN for a provider + date range.
     * Also removes dates from template exceptionDates.
     */
    @PostMapping("/slots/bulk-unblock")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<?> bulkUnblockSlots(
            @RequestBody BulkBlockRequest req,
            Authentication auth) {
        try {
            CachedAuthSession session = getSession(auth);
            String orgId = hasRole(auth, "ADMIN") && req.getOrganizationId() != null
                    ? req.getOrganizationId()
                    : session.getOrganizationId();

            int count = scheduleService.bulkUnblockSlots(
                    orgId, req.getProviderId(),
                    req.getFromDate(), req.getToDate());

            return ResponseEntity.ok(Map.of(
                    "message", count + " slot(s) unblocked successfully.",
                    "unblockedCount", count));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // APPOINTMENTS
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * GET /api/scheduling/appointments
     * Returns appointments for the caller's org (or all for ADMIN).
     * Optional ?status=SCHEDULED filter.
     */
    @GetMapping("/appointments")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN')")
    public ResponseEntity<?> getAppointments(
            @RequestParam(required = false) String status,
            Authentication auth) {
        try {
            CachedAuthSession session = getSession(auth);
            boolean isAdmin = hasRole(auth, "ADMIN");
            List<Appointment> appts;

            if (isAdmin) {
                appts = (status != null && !status.isBlank())
                        ? appointmentRepository.findAll().stream()
                            .filter(a -> status.equalsIgnoreCase(a.getStatus())).toList()
                        : appointmentRepository.findAll();
            } else {
                appts = (status != null && !status.isBlank())
                        ? appointmentRepository.findByOrganizationIdAndStatus(
                                session.getOrganizationId(), status)
                        : appointmentRepository.findByOrganizationId(session.getOrganizationId());
            }

            for (Appointment appt : appts) {
                PatientSearchResultDTO p = patientAdminService.getPatientById(appt.getPatientId());
                if (p != null) {
                    if (appt.getPatientName() == null || appt.getPatientName().isBlank()) {
                        appt.setPatientName(p.getDisplayName() != null && !p.getDisplayName().isBlank() 
                                ? p.getDisplayName() : p.getPatientName());
                    }
                    if (appt.getPatientPhone() == null || appt.getPatientPhone().isBlank()) {
                        appt.setPatientPhone(p.getPatientPhone() != null && !p.getPatientPhone().isBlank()
                                ? p.getPatientPhone() : p.getPhone());
                    }
                } else {
                    if (appt.getPatientName() == null || appt.getPatientName().isBlank()) {
                        appt.setPatientName(appt.getPatientId());
                    }
                }
                if (appt.getProviderName() == null || appt.getProviderName().isBlank()) {
                    com.healthcare.epcr.user.model.User doc = userRepository.findById(appt.getProviderId()).orElse(null);
                    if (doc != null) {
                        appt.setProviderName("Dr. " + doc.getFirstName() + " " + doc.getLastName());
                    } else {
                        appt.setProviderName("Doctor (" + appt.getProviderId() + ")");
                    }
                }
                if (appt.getAppointmentType() == null || appt.getAppointmentType().isBlank()) {
                    appt.setAppointmentType("General");
                }
            }

            return ResponseEntity.ok(appts);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * POST /api/scheduling/appointments  (original booking via slotId)
     */
    @PostMapping("/appointments")
    @PreAuthorize("hasAnyRole('ADMIN', 'PARAMEDIC', 'PHYSICIAN')")
    public ResponseEntity<?> bookAppointment(
            @RequestBody BookingRequest req,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            Authentication auth) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Idempotency-Key header is required for appointment booking."));
        }
        try {
            CachedAuthSession session = getSession(auth);
            Appointment appt = scheduleService.bookSlot(
                    req.getSlotId(), req.getPatientId(), req.getPatientName(),
                    session.getOrganizationId(), req.getReasonForVisit(), idempotencyKey);
            return ResponseEntity.status(HttpStatus.CREATED).body(appt);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/appointments/{id}/reschedule")
    @PreAuthorize("hasAnyRole('ADMIN', 'PARAMEDIC', 'PHYSICIAN')")
    public ResponseEntity<?> rescheduleAppointment(
            @PathVariable String id,
            @RequestParam String newSlotId) {
        try {
            return ResponseEntity.ok(scheduleService.reschedule(id, newSlotId));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/appointments/{id}/cancel")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN')")
    public ResponseEntity<?> cancelAppointment(@PathVariable String id) {
        try {
            return ResponseEntity.ok(scheduleService.cancelAppointment(id));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // TRAVEL BUNDLES
    // ══════════════════════════════════════════════════════════════════════════

    @GetMapping("/travel-bundles")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN')")
    public ResponseEntity<?> getTravelBundles(Authentication auth) {
        try {
            CachedAuthSession session = getSession(auth);
            boolean isAdmin = hasRole(auth, "ADMIN");
            List<TravelBundle> bundles = isAdmin
                    ? travelBundleRepository.findAll()
                    : travelBundleRepository.findByOrganizationId(session.getOrganizationId());
            for (TravelBundle b : bundles) {
                if (b.getPatientName() == null || b.getPatientName().isBlank()) {
                    PatientSearchResultDTO p = patientAdminService.getPatientById(b.getPatientId());
                    if (p != null) {
                        b.setPatientName(p.getDisplayName() != null && !p.getDisplayName().isBlank() 
                                ? p.getDisplayName() : p.getPatientName());
                    } else {
                        b.setPatientName(b.getPatientId());
                    }
                }
            }
            return ResponseEntity.ok(bundles);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping("/travel-bundles")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN')")
    public ResponseEntity<?> createTravelBundle(
            @RequestBody TravelBundle bundle,
            Authentication auth) {
        try {
            CachedAuthSession session = getSession(auth);
            boolean isAdmin = hasRole(auth, "ADMIN");
            if (!isAdmin || bundle.getOrganizationId() == null || bundle.getOrganizationId().isBlank()) {
                bundle.setOrganizationId(session.getOrganizationId());
            }
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(scheduleService.createTravelBundle(bundle));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/travel-bundles/suggestions")
    @PreAuthorize("hasAnyRole('ADMIN', 'PARAMEDIC', 'PHYSICIAN')")
    public ResponseEntity<?> getTravelSuggestions(
            @RequestParam String patientId,
            @RequestParam String destinationFacilityId,
            @RequestParam String slotStartTime) {
        try {
            Instant time = Instant.parse(slotStartTime);
            return ResponseEntity.ok(
                    scheduleService.suggestTravelBundle(patientId, destinationFacilityId, time)
                            .map(msg -> Map.of("suggested", true, "message", msg))
                            .orElse(Map.of("suggested", false)));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // STATS
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * GET /api/scheduling/stats
     * Returns counts for the dashboard stats row.
     * Org-scoped for non-admin users.
     */
    @GetMapping("/stats")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN')")
    public ResponseEntity<?> getStats(Authentication auth) {
        try {
            CachedAuthSession session = getSession(auth);
            boolean isAdmin = hasRole(auth, "ADMIN");
            return ResponseEntity.ok(
                    scheduleService.getStats(session.getOrganizationId(), isAdmin));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ADMIN-ONLY UTILITIES
    // ══════════════════════════════════════════════════════════════════════════

    @PostMapping("/generate-slots")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> forceGenerateSlots(
            @RequestParam(defaultValue = "60") int daysAhead) {
        try {
            slotGenerationJob.generateSlotsForHorizon(daysAhead);
            return ResponseEntity.ok(Map.of(
                    "message", "Slots generated for next " + daysAhead + " days."));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // FACILITIES LOOKUP — returns active facility IDs across templates and slots
    // ══════════════════════════════════════════════════════════════════════════

    @GetMapping("/facilities")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'QA_REVIEWER', 'PATIENT')")
    public ResponseEntity<List<String>> getFacilities(Authentication auth) {
        try {
            // Find all distinct facility IDs from templates/slots
            List<String> facilities = slotRepository.findAll().stream()
                    .map(AppointmentSlot::getFacilityId)
                    .filter(f -> f != null && !f.isBlank())
                    .distinct()
                    .collect(Collectors.toList());

            // If empty, fall back to template repository
            if (facilities.isEmpty()) {
                facilities = templateRepository.findAll().stream()
                        .map(ProviderScheduleTemplate::getFacilityId)
                        .filter(f -> f != null && !f.isBlank())
                        .distinct()
                        .collect(Collectors.toList());
            }

            // Default fallbacks if database is completely empty
            if (facilities.isEmpty()) {
                facilities = List.of("FAC-001", "FAC-002", "FAC-003", "FAC-004", "FAC-005");
            }

            return ResponseEntity.ok(facilities);
        } catch (Exception e) {
            return ResponseEntity.ok(List.of("FAC-001", "FAC-002", "FAC-003", "FAC-004", "FAC-005"));
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PRIVATE HELPERS
    // ══════════════════════════════════════════════════════════════════════════

    private CachedAuthSession getSession(Authentication auth) {
        if (auth != null && auth.getDetails() instanceof CachedAuthSession session) {
            return session;
        }
        throw new IllegalStateException("Authentication session not found.");
    }

    private boolean hasRole(Authentication auth, String role) {
        return auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_" + role));
    }

    // ── Request DTOs ──────────────────────────────────────────────────────────

    @Data
    public static class BookingRequest {
        private String slotId;
        private String patientId;
        private String patientName;
        private String reasonForVisit;
    }

    @Data
    public static class BookSlotRequest {
        private String patientId;
        private String patientName;
        private String notes;
    }

    @Data
    public static class BulkBlockRequest {
        private String providerId;
        private String fromDate;      // YYYY-MM-DD
        private String toDate;        // YYYY-MM-DD
        private String reason;        // e.g. "Annual Leave"
        private String organizationId; // optional, admin only
    }

    @Data
    public static class GenerateRequest {
        private String startDate;   // YYYY-MM-DD
        private String endDate;     // YYYY-MM-DD
    }
}
