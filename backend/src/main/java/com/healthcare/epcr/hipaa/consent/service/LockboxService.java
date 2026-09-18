package com.healthcare.epcr.hipaa.consent.service;

import com.healthcare.epcr.auditlog.service.AuditLogService;
import com.healthcare.epcr.hipaa.breakglass.model.BreakGlassEvent;
import com.healthcare.epcr.hipaa.breakglass.repository.BreakGlassRepository;
import com.healthcare.epcr.hipaa.consent.model.PatientConsent;
import com.healthcare.epcr.hipaa.consent.repository.PatientConsentRepository;
import com.healthcare.epcr.security.AccessControlService;
import com.healthcare.epcr.user.model.Role;
import com.healthcare.epcr.user.model.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * TPH PIM-1.1 — Patient Lockbox Service.
 *
 * Manages per-patient lockbox settings (which PHI categories are self-locked
 * by the patient) and clinician override grants.
 *
 * Valid lockbox categories:
 *   HIV_STATUS, MENTAL_HEALTH, SUBSTANCE_ABUSE, GENETIC_INFO
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LockboxService {

    public static final Set<String> VALID_CATEGORIES =
            Set.of("HIV_STATUS", "MENTAL_HEALTH", "SUBSTANCE_ABUSE", "GENETIC_INFO");

    /** Roles that are ALWAYS allowed to see all PHI (unless patient blocks them individually) */
    private static final Set<Role> PRIVILEGED_ROLES = Set.of(Role.ADMIN);

    private final PatientConsentRepository consentRepository;
    private final BreakGlassRepository breakGlassRepository;
    private final AccessControlService accessControlService;
    private final AuditLogService auditLogService;

    // ─── Read ───────────────────────────────────────────────────────────────

    /**
     * Returns the active locked categories for this patient.
     * Returns an empty list if no lockbox is configured.
     */
    public List<String> getLockboxCategories(String patientId) {
        return findLockboxConsent(patientId)
                .filter(PatientConsent::isLockboxActive)
                .map(c -> c.getLockboxCategories() != null ? c.getLockboxCategories() : Collections.<String>emptyList())
                .orElse(Collections.emptyList());
    }

    /**
     * Returns true if the given category is currently locked for this patient.
     */
    public boolean isCategoryLocked(String patientId, String category) {
        return getLockboxCategories(patientId).contains(category);
    }

    /**
     * Returns the full lockbox consent record for display (patient portal).
     */
    public Optional<PatientConsent> getLockboxConsent(String patientId) {
        return findLockboxConsent(patientId);
    }

    // ─── Write ──────────────────────────────────────────────────────────────

    /**
     * Patient sets/updates their lockbox categories.
     * Called from the Patient Portal Privacy tab.
     *
     * @param patientId  patient whose lockbox is being updated
     * @param categories list of PHI categories to lock (empty list = unlock all)
     * @param actorId    patientId of the actor (must be the same patient or ADMIN)
     */
    public PatientConsent setLockbox(String patientId, List<String> categories, String actorId) {
        // Validate categories
        List<String> sanitized = categories == null ? new ArrayList<>() :
                categories.stream()
                        .filter(VALID_CATEGORIES::contains)
                        .distinct()
                        .toList();

        PatientConsent consent = findLockboxConsent(patientId)
                .orElseGet(() -> buildNewLockboxConsent(patientId));

        consent.setLockboxCategories(sanitized);
        consent.setLockboxActive(!sanitized.isEmpty());
        consent.setLockboxUpdatedAt(LocalDateTime.now());
        consent.setUpdatedAt(LocalDateTime.now());

        PatientConsent saved = consentRepository.save(consent);

        auditLogService.logAction(
                actorId,
                "LOCKBOX_UPDATED",
                "PatientConsent",
                saved.getId(),
                "Patient lockbox updated. Active=" + saved.isLockboxActive()
                        + " Categories=" + sanitized
        );

        log.info("Lockbox updated for patient={} by actor={}: categories={}", patientId, actorId, sanitized);
        return saved;
    }

    // ─── Override Grant ──────────────────────────────────────────────────────

    /**
     * Patient grants a specific clinician permission to bypass their lockbox.
     */
    public PatientConsent grantOverride(String patientId, String clinicianUserId, String actorId) {
        PatientConsent consent = findLockboxConsent(patientId)
                .orElseGet(() -> buildNewLockboxConsent(patientId));

        List<String> grants = new ArrayList<>(
                consent.getOverrideGrantedUserIds() != null ? consent.getOverrideGrantedUserIds() : new ArrayList<>()
        );
        if (!grants.contains(clinicianUserId)) {
            grants.add(clinicianUserId);
        }
        consent.setOverrideGrantedUserIds(grants);
        consent.setUpdatedAt(LocalDateTime.now());

        PatientConsent saved = consentRepository.save(consent);

        auditLogService.logAction(
                actorId,
                "LOCKBOX_OVERRIDE_GRANTED",
                "PatientConsent",
                saved.getId(),
                "Clinician userId=" + clinicianUserId + " granted lockbox override by actor=" + actorId
        );

        log.info("Lockbox override granted: patient={} clinician={} by actor={}", patientId, clinicianUserId, actorId);
        return saved;
    }

    /**
     * Patient revokes a previously granted override from a clinician.
     */
    public PatientConsent revokeOverride(String patientId, String clinicianUserId, String actorId) {
        PatientConsent consent = findLockboxConsent(patientId)
                .orElseThrow(() -> new IllegalArgumentException("No lockbox record found for patient: " + patientId));

        List<String> grants = new ArrayList<>(
                consent.getOverrideGrantedUserIds() != null ? consent.getOverrideGrantedUserIds() : new ArrayList<>()
        );
        grants.remove(clinicianUserId);
        consent.setOverrideGrantedUserIds(grants);
        consent.setUpdatedAt(LocalDateTime.now());

        PatientConsent saved = consentRepository.save(consent);

        auditLogService.logAction(
                actorId,
                "LOCKBOX_OVERRIDE_REVOKED",
                "PatientConsent",
                saved.getId(),
                "Clinician userId=" + clinicianUserId + " lockbox override revoked by actor=" + actorId
        );

        log.info("Lockbox override revoked: patient={} clinician={} by actor={}", patientId, clinicianUserId, actorId);
        return saved;
    }

    // ─── Authorization Check ─────────────────────────────────────────────────

    /**
     * Returns true if the current authenticated user is allowed to see locked PHI
     * for this patient.
     *
     * Bypass is granted if:
     *  1. The user is ADMIN role, OR
     *  2. The patient has explicitly granted override to this user's ID, OR
     *  3. The user has an active, non-expired Break-Glass session for this patient
     */
    public boolean currentUserHasLockboxOverride(String patientId) {
        try {
            User currentUser = accessControlService.currentUser();
            // 1. ADMIN always bypasses
            if (PRIVILEGED_ROLES.contains(currentUser.getRole())) {
                return true;
            }

            // 2. Check explicit patient grant
            boolean hasPatientGrant = findLockboxConsent(patientId)
                    .map(c -> c.getOverrideGrantedUserIds() != null
                            && c.getOverrideGrantedUserIds().contains(currentUser.getId()))
                    .orElse(false);
            if (hasPatientGrant) {
                return true;
            }

            // 3. Check active, non-expired Break-Glass emergency session
            List<BreakGlassEvent> activeEvents = breakGlassRepository.findByUserIdAndPatientIdAndStatus(
                    currentUser.getId(), patientId, "ACTIVE"
            );
            LocalDateTime now = LocalDateTime.now();
            boolean hasActiveBreakGlass = activeEvents.stream()
                    .anyMatch(e -> e.getExpiresAt() != null && e.getExpiresAt().isAfter(now));

            if (hasActiveBreakGlass) {
                log.info("Lockbox bypass granted via active Break-Glass emergency session for user={} on patient={}",
                        currentUser.getId(), patientId);
                return true;
            }

            return false;
        } catch (Exception e) {
            log.warn("Could not resolve current user for lockbox override check on patient={}", patientId, e);
            return false;
        }
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    private Optional<PatientConsent> findLockboxConsent(String patientId) {
        return consentRepository
                .findByPatientIdOrderByCreatedAtDesc(patientId)
                .stream()
                .filter(c -> "LOCKBOX".equals(c.getConsentType()))
                .findFirst();
    }

    private PatientConsent buildNewLockboxConsent(String patientId) {
        PatientConsent c = new PatientConsent();
        c.setPatientId(patientId);
        c.setConsentType("LOCKBOX");
        c.setStatus("GRANTED");
        c.setLockboxActive(false);
        c.setLockboxCategories(new ArrayList<>());
        c.setOverrideGrantedUserIds(new ArrayList<>());
        c.setCreatedAt(LocalDateTime.now());
        c.setUpdatedAt(LocalDateTime.now());
        return c;
    }
}
