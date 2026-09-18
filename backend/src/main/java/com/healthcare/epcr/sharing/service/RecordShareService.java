package com.healthcare.epcr.sharing.service;

import com.healthcare.epcr.auditlog.service.AuditLogService;
import com.healthcare.epcr.auth.service.JwtService;
import com.healthcare.epcr.epcr.model.PatientCareRecord;
import com.healthcare.epcr.epcr.repository.PatientCareRecordRepository;
import com.healthcare.epcr.notification.service.EmailService;
import com.healthcare.epcr.organization.model.Organization;
import com.healthcare.epcr.organization.repository.OrganizationRepository;
import com.healthcare.epcr.phi.crypto.PhiCryptoService;
import com.healthcare.epcr.sharing.dto.CreateShareRequest;
import com.healthcare.epcr.sharing.dto.ShareResponse;
import com.healthcare.epcr.sharing.enums.ShareStatus;
import com.healthcare.epcr.sharing.enums.ShareType;
import com.healthcare.epcr.sharing.model.RecordShare;
import com.healthcare.epcr.sharing.repository.RecordShareRepository;
import com.healthcare.epcr.user.model.User;
import com.healthcare.epcr.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class RecordShareService {

    private static final String REDIS_KEY_PREFIX = "share-access:";
    private static final int DEFAULT_EXTERNAL_EXPIRY_HOURS = 72;

    private final RecordShareRepository recordShareRepository;
    private final PatientCareRecordRepository epcrRecordRepository;
    private final UserRepository userRepository;
    private final OrganizationRepository organizationRepository;
    private final StringRedisTemplate redisTemplate;
    private final PhiCryptoService phiCryptoService;
    private final AuditLogService auditLogService;
    private final JwtService jwtService;
    private final EmailService emailService;

    @Value("${app.frontend.base-url:https://ihp.ind.in/epcr}")
    private String frontendBaseUrl;

    // ---------------------------------------------------------------
    // CREATE
    // ---------------------------------------------------------------

    public ShareResponse createShare(CreateShareRequest req, String recordId, String organizationId,
                                      String sharedByUserId, String sharedByName) {

        validateCreateRequest(req);

        String patientId = epcrRecordRepository.findById(recordId)
                .map(PatientCareRecord::getPatientId)
                .orElse(recordId);

        RecordShare share = new RecordShare();
        share.setOrganizationId(organizationId);
        share.setRecordId(recordId);
        share.setPatientId(patientId);
        share.setSharedByUserId(sharedByUserId);
        share.setSharedByName(sharedByName);
        share.setShareType(req.getShareType());
        share.setStatus(ShareStatus.PENDING);
        share.setSpecialtyRequested(req.getSpecialtyRequested());
        share.setIncludeFullEpcr(req.isIncludeFullEpcr());
        share.setIncludeVitalsHistory(req.isIncludeVitalsHistory());
        share.setIncludedDocumentIds(req.getIncludedDocumentIds());
        share.setIncludedLabResultIds(req.getIncludedLabResultIds());
        share.setLinkedAmbulatoryReferralId(req.getLinkedAmbulatoryReferralId());

        String rawToken = null;

        if (req.getShareType() == ShareType.INTERNAL) {
            share.setSpecialistUserId(req.getSpecialistUserId());
            // Store target specialist name if provided, or resolve dynamically
            if (req.getSpecialistName() != null && !req.getSpecialistName().isBlank()) {
                share.setSpecialistName(phiCryptoService.encrypt(req.getSpecialistName()));
            } else if (req.getSpecialistUserId() != null) {
                userRepository.findById(req.getSpecialistUserId()).ifPresent(u -> {
                    String fn = (u.getFirstName() != null ? u.getFirstName() : "") +
                            (u.getLastName() != null ? " " + u.getLastName() : "");
                    if (!fn.trim().isEmpty()) {
                        share.setSpecialistName(phiCryptoService.encrypt(fn.trim()));
                    }
                });
            }
        } else {
            if (req.getSpecialistEmail() != null) {
                share.setSpecialistEmail(phiCryptoService.encrypt(req.getSpecialistEmail()));
            }
            if (req.getSpecialistName() != null) {
                share.setSpecialistName(phiCryptoService.encrypt(req.getSpecialistName()));
            }
            share.setSpecialistOrganizationName(req.getSpecialistOrganizationName());

            rawToken = generateSecureToken();
            share.setAccessTokenHash(hashToken(rawToken));

            int expiryHours = req.getExpiryHours() != null ? req.getExpiryHours() : DEFAULT_EXTERNAL_EXPIRY_HOURS;
            share.setExpiresAt(Instant.now().plus(expiryHours, ChronoUnit.HOURS));
        }

        if (req.getClinicalQuestion() != null) {
            share.setClinicalQuestion(phiCryptoService.encrypt(req.getClinicalQuestion()));
        }

        share.setCreatedAt(Instant.now());
        share.setUpdatedAt(Instant.now());

        RecordShare saved = recordShareRepository.save(share);

        if (req.getShareType() == ShareType.EXTERNAL) {
            storeExternalTokenInRedis(saved.getId(), saved.getAccessTokenHash(),
                    req.getExpiryHours() != null ? req.getExpiryHours() : DEFAULT_EXTERNAL_EXPIRY_HOURS);
        }

        sendNotificationEmail(saved, req, rawToken);

        auditLogService.logAction(
                sharedByUserId,
                "CREATE_RECORD_SHARE",
                "RecordShare",
                saved.getId(),
                "Record shared via " + req.getShareType() + " for record: " + recordId
        );

        return toResponse(saved, true);
    }

    private void sendNotificationEmail(RecordShare share, CreateShareRequest req, String externalToken) {
        try {
            String recipientEmail = null;
            if (share.getShareType() == ShareType.INTERNAL && share.getSpecialistUserId() != null) {
                recipientEmail = userRepository.findById(share.getSpecialistUserId())
                        .map(User::getEmail)
                        .orElse(null);
            } else if (share.getShareType() == ShareType.EXTERNAL) {
                recipientEmail = req.getSpecialistEmail();
            }

            if (recipientEmail == null || recipientEmail.isBlank()) {
                log.warn("No recipient email found for share ID: {}", share.getId());
                return;
            }

            String baseUrl = frontendBaseUrl != null ? frontendBaseUrl.replaceAll("/+$", "") : "https://ihp.ind.in/epcr";
            if (!baseUrl.endsWith("/epcr")) {
                baseUrl = baseUrl + "/epcr";
            }

            String actionUrl;
            if (share.getShareType() == ShareType.EXTERNAL && externalToken != null) {
                actionUrl = baseUrl + "/shared/" + share.getId() + "?token=" + externalToken;
            } else {
                actionUrl = baseUrl + "/shared/" + share.getId();
            }

            String clinicalNote = req.getClinicalQuestion() != null ? req.getClinicalQuestion() : "No clinical notes provided.";
            String specialty = share.getSpecialtyRequested() != null ? share.getSpecialtyRequested() : "General Consultation";
            String sharerName = share.getSharedByName() != null ? share.getSharedByName() : "Attending Doctor";

            String subject = "Medical Record Share Notification - Record " + share.getRecordId();
            String htmlContent = "<div style=\"font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;\">" +
                    "  <div style=\"background: #1e3a8a; padding: 24px; text-align: center; color: white;\">" +
                    "    <h2 style=\"margin: 0; font-size: 20px; font-weight: 700;\">Smart-eHR Health Platform</h2>" +
                    "    <p style=\"margin: 4px 0 0 0; opacity: 0.8; font-size: 13px;\">New Medical Record Shared For Consultation</p>" +
                    "  </div>" +
                    "  <div style=\"padding: 24px; color: #1e293b; line-height: 1.6;\">" +
                    "    <p style=\"margin-top: 0;\">Dear Doctor,</p>" +
                    "    <p><strong>Dr. " + sharerName + "</strong> has shared a patient medical record with you for clinical review and consultation.</p>" +
                    "    <div style=\"background: #f8fafc; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0; border-radius: 6px;\">" +
                    "      <p style=\"margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 700;\">Share Consultation Summary</p>" +
                    "      <p style=\"margin: 4px 0;\"><strong>Record Reference:</strong> " + share.getRecordId() + "</p>" +
                    "      <p style=\"margin: 4px 0;\"><strong>Specialty Requested:</strong> " + specialty + "</p>" +
                    "      <p style=\"margin: 4px 0;\"><strong>Referring Doctor:</strong> Dr. " + sharerName + "</p>" +
                    "      <p style=\"margin: 4px 0;\"><strong>Clinical Note / Question:</strong> " + clinicalNote + "</p>" +
                    "    </div>" +
                    "    <div style=\"text-align: center; margin: 28px 0;\">" +
                    "      <a href=\"" + actionUrl + "\" style=\"background: #2563eb; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block;\">View Shared Medical Record</a>" +
                    "    </div>" +
                    "    <p style=\"font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 16px; margin-bottom: 0;\">" +
                    "      This email contains confidential medical information protected under HIPAA & ePCR security regulations. If received in error, please notify system support." +
                    "    </p>" +
                    "  </div>" +
                    "</div>";

            emailService.sendEmail(recipientEmail, subject, htmlContent);
            log.info("Notification email sent successfully to {} for record share {}", recipientEmail, share.getId());
        } catch (Exception e) {
            log.error("Failed to send share notification email for share ID: {}", share.getId(), e);
        }
    }

    private void validateCreateRequest(CreateShareRequest req) {
        if (req.getShareType() == ShareType.INTERNAL && req.getSpecialistUserId() == null) {
            throw new IllegalArgumentException("specialistUserId is required for INTERNAL shares");
        }
        if (req.getShareType() == ShareType.EXTERNAL && req.getSpecialistEmail() == null) {
            throw new IllegalArgumentException("specialistEmail is required for EXTERNAL shares");
        }
    }

    // ---------------------------------------------------------------
    // READ — internal, authenticated users
    // ---------------------------------------------------------------

    public List<ShareResponse> getSharesForRecord(String recordId, String organizationId) {
        return recordShareRepository.findByOrganizationIdAndRecordId(organizationId, recordId)
                .stream()
                .map(s -> toResponse(s, true))
                .toList();
    }

    public Page<ShareResponse> getInbox(String userId, Pageable pageable) {
        return getInbox(userId, null, null, pageable);
    }

    public Page<ShareResponse> getInbox(String userId, String userRole, String organizationId, Pageable pageable) {
        Page<RecordShare> shares;
        if ("ADMIN".equalsIgnoreCase(userRole) || "ROLE_ADMIN".equalsIgnoreCase(userRole)) {
            if (organizationId != null && !organizationId.isBlank()) {
                shares = recordShareRepository.findByOrganizationIdOrderByCreatedAtDesc(organizationId, pageable);
                if (shares.isEmpty()) {
                    shares = recordShareRepository.findAllByOrderByCreatedAtDesc(pageable);
                }
            } else {
                shares = recordShareRepository.findAllByOrderByCreatedAtDesc(pageable);
            }
        } else {
            shares = recordShareRepository.findBySpecialistUserIdOrSharedByUserIdOrderByCreatedAtDesc(userId, userId, pageable);
            if (shares.isEmpty() && organizationId != null && !organizationId.isBlank()) {
                Page<RecordShare> orgShares = recordShareRepository.findByOrganizationIdOrderByCreatedAtDesc(organizationId, pageable);
                if (!orgShares.isEmpty()) {
                    shares = orgShares;
                }
            }
        }
        return shares.map(s -> toResponse(s, true));
    }

    /** Marks the share VIEWED the first time the assigned specialist opens it. */
    public ShareResponse viewInternalShare(String shareId, String organizationId, String requestingUserId) {
        RecordShare share = recordShareRepository.findByIdAndOrganizationId(shareId, organizationId)
                .orElseThrow(() -> new IllegalArgumentException("Share not found"));

        if (!requestingUserId.equals(share.getSpecialistUserId())
                && !requestingUserId.equals(share.getSharedByUserId())) {
            throw new AccessDeniedException("Not authorized to view this share");
        }

        if (share.getStatus() == ShareStatus.PENDING) {
            markViewed(share, requestingUserId);
        }
        return toResponse(share, true);
    }

    public ShareResponse revokeShare(String shareId, String organizationId, String requestingUserId) {
        RecordShare share = recordShareRepository.findByIdAndOrganizationId(shareId, organizationId)
                .orElseThrow(() -> new IllegalArgumentException("Share not found"));

        if (!requestingUserId.equals(share.getSharedByUserId())) {
            throw new AccessDeniedException("Only the sharing provider can revoke this share");
        }

        share.setStatus(ShareStatus.REVOKED);
        share.setRevokedAt(Instant.now());
        share.setRevokedByUserId(requestingUserId);
        share.setUpdatedAt(Instant.now());

        try {
            RecordShare saved = recordShareRepository.save(share);
            redisTemplate.delete(REDIS_KEY_PREFIX + shareId);
            auditLogService.logActionWithStatus(requestingUserId, "SHARE_REVOKED", "RECORD_SHARE", shareId, "Revoked share", "SUCCESS", null);
            publishEvent(saved, "REVOKED", null);
            return toResponse(saved, true);
        } catch (OptimisticLockingFailureException e) {
            throw new IllegalStateException("Share was modified concurrently, please retry");
        }
    }

    public ShareResponse addResponse(String shareId, String organizationId, String responderId, String responseNotes) {
        RecordShare share = recordShareRepository.findByIdAndOrganizationId(shareId, organizationId)
                .orElseThrow(() -> new IllegalArgumentException("Share not found"));

        if (!responderId.equals(share.getSpecialistUserId())) {
            throw new AccessDeniedException("Only the assigned specialist can respond");
        }

        if (responseNotes != null) {
            share.setResponseNotes(phiCryptoService.encrypt(responseNotes));
        }
        share.setStatus(ShareStatus.RESPONDED);
        share.setRespondedAt(Instant.now());
        share.setUpdatedAt(Instant.now());

        RecordShare saved = recordShareRepository.save(share);
        auditLogService.logActionWithStatus(responderId, "SHARE_RESPONDED", "RECORD_SHARE", shareId, "Responded to share", "SUCCESS", null);
        publishEvent(saved, "RESPONDED", null);
        return toResponse(saved, true);
    }

    // ---------------------------------------------------------------
    // EXTERNAL — unauthenticated up to token verification
    // ---------------------------------------------------------------

    /** Step 1: verify the raw token against the Redis-stored hash, return a scoped JWT. */
    public String verifyExternalToken(String shareId, String rawToken) {
        String redisKey = REDIS_KEY_PREFIX + shareId;
        String storedHash = redisTemplate.opsForValue().get(redisKey);

        if (storedHash == null) {
            throw new AccessDeniedException("This link has expired or is no longer valid");
        }
        if (!storedHash.equals(hashToken(rawToken))) {
            throw new AccessDeniedException("Invalid access token");
        }

        RecordShare share = recordShareRepository.findById(shareId)
                .orElseThrow(() -> new IllegalArgumentException("Share not found"));

        if (share.getStatus() == ShareStatus.REVOKED) {
            throw new AccessDeniedException("This share has been revoked");
        }

        if (share.getStatus() == ShareStatus.PENDING) {
            markViewed(share, null);
        }

        return jwtService.generateToken(shareId, "EXTERNAL_SHARE", share.getOrganizationId(), "EXTERNAL_SPECIALIST");
    }

    /** Step 2: fetch the bundle using the scoped token's claims (shareId only, nothing else). */
    public ShareResponse getExternalShareBundle(String shareId) {
        RecordShare share = recordShareRepository.findById(shareId)
                .orElseThrow(() -> new IllegalArgumentException("Share not found"));

        if (share.getStatus() == ShareStatus.REVOKED) {
            throw new AccessDeniedException("This share has been revoked");
        }
        if (share.getExpiresAt() != null && share.getExpiresAt().isBefore(Instant.now())) {
            throw new AccessDeniedException("This link has expired");
        }
        return toResponse(share, false);
    }

    public ShareResponse respondToExternalShare(String shareId, String responseNotes) {
        RecordShare share = recordShareRepository.findById(shareId)
                .orElseThrow(() -> new IllegalArgumentException("Share not found"));

        if (share.getStatus() == ShareStatus.REVOKED) {
            throw new AccessDeniedException("This share has been revoked");
        }

        if (responseNotes != null) {
            share.setResponseNotes(phiCryptoService.encrypt(responseNotes));
        }
        share.setStatus(ShareStatus.RESPONDED);
        share.setRespondedAt(Instant.now());
        share.setUpdatedAt(Instant.now());

        RecordShare saved = recordShareRepository.save(share);
        auditLogService.logActionWithStatus("EXTERNAL_SPECIALIST", "SHARE_RESPONDED", "RECORD_SHARE", shareId, "Responded to external share", "SUCCESS", null);
        publishEvent(saved, "RESPONDED", null);
        return toResponse(saved, false);
    }

    // ---------------------------------------------------------------
    // Housekeeping
    // ---------------------------------------------------------------

    public void expireStaleShares() {
        List<RecordShare> stale = recordShareRepository.findByStatusAndExpiresAtBefore(ShareStatus.PENDING, Instant.now());
        for (RecordShare s : stale) {
            s.setStatus(ShareStatus.EXPIRED);
            s.setUpdatedAt(Instant.now());
            recordShareRepository.save(s);
            publishEvent(s, "EXPIRED", null);
        }
    }

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    private void markViewed(RecordShare share, String viewerUserId) {
        share.setStatus(ShareStatus.VIEWED);
        share.setViewedAt(Instant.now());
        share.setUpdatedAt(Instant.now());
        recordShareRepository.save(share);
        auditLogService.logActionWithStatus(viewerUserId != null ? viewerUserId : "EXTERNAL_USER", "SHARE_VIEWED", "RECORD_SHARE", share.getId(), "Viewed share", "SUCCESS", null);
        publishEvent(share, "VIEWED", null);
    }

    private void publishEvent(RecordShare share, String eventType, String plainToken) {
        String link = share.getShareType() == ShareType.EXTERNAL
                ? frontendBaseUrl + "/shared/" + share.getId() + "?token=" + plainToken
                : null;

        String decryptedEmail = phiCryptoService.decrypt(share.getSpecialistEmail());

        log.info("[RecordShare Event] eventType={} shareId={} recordId={} recipient={} link={}",
                eventType, share.getId(), share.getRecordId(),
                decryptedEmail != null ? decryptedEmail : share.getSpecialistUserId(), link);
    }

    private String generateSecureToken() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hashToken(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hash);
        } catch (Exception e) {
            throw new IllegalStateException("Unable to hash token", e);
        }
    }

    public void storeExternalTokenInRedis(String shareId, String hashedToken, int expiryHours) {
        redisTemplate.opsForValue().set(REDIS_KEY_PREFIX + shareId, hashedToken, expiryHours, TimeUnit.HOURS);
    }

    private ShareResponse toResponse(RecordShare s, boolean includeSensitive) {
        String specialistName = phiCryptoService.decrypt(s.getSpecialistName());
        if ((specialistName == null || specialistName.isBlank()) && s.getSpecialistUserId() != null) {
            specialistName = userRepository.findById(s.getSpecialistUserId())
                    .map(u -> ((u.getFirstName() != null ? u.getFirstName() : "") + " " + (u.getLastName() != null ? u.getLastName() : "")).trim())
                    .filter(name -> !name.isEmpty())
                    .orElse(null);
        }

        String organizationName = null;
        if (s.getOrganizationId() != null && !s.getOrganizationId().isBlank()) {
            organizationName = organizationRepository.findById(s.getOrganizationId())
                    .map(Organization::getName)
                    .orElseGet(() -> organizationRepository.findByCode(s.getOrganizationId())
                            .map(Organization::getName)
                            .orElse(null));
        }
        if ((organizationName == null || organizationName.isBlank()) && s.getSpecialistOrganizationName() != null) {
            organizationName = s.getSpecialistOrganizationName();
        }
        if ((organizationName == null || organizationName.isBlank()) && s.getSharedByUserId() != null) {
            organizationName = userRepository.findById(s.getSharedByUserId())
                    .map(User::getOrganizationId)
                    .filter(orgId -> orgId != null && !orgId.isBlank())
                    .flatMap(orgId -> organizationRepository.findById(orgId).map(Organization::getName)
                            .or(() -> organizationRepository.findByCode(orgId).map(Organization::getName)))
                    .orElse(null);
        }
        if ((organizationName == null || organizationName.isBlank()) && s.getSpecialistUserId() != null) {
            organizationName = userRepository.findById(s.getSpecialistUserId())
                    .map(User::getOrganizationId)
                    .filter(orgId -> orgId != null && !orgId.isBlank())
                    .flatMap(orgId -> organizationRepository.findById(orgId).map(Organization::getName)
                            .or(() -> organizationRepository.findByCode(orgId).map(Organization::getName)))
                    .orElse(null);
        }
        if ((organizationName == null || organizationName.isBlank()) && s.getRecordId() != null) {
            organizationName = epcrRecordRepository.findById(s.getRecordId())
                    .map(PatientCareRecord::getOrganizationId)
                    .filter(orgId -> orgId != null && !orgId.isBlank())
                    .flatMap(orgId -> organizationRepository.findById(orgId).map(Organization::getName)
                            .or(() -> organizationRepository.findByCode(orgId).map(Organization::getName)))
                    .orElse(null);
        }
        if (organizationName == null || organizationName.isBlank()) {
            organizationName = s.getOrganizationId() != null && !s.getOrganizationId().isBlank()
                    ? "Org (" + s.getOrganizationId() + ")"
                    : "General Organization";
        }

        Object epcrRecordData = null;
        if (s.getRecordId() != null) {
            epcrRecordData = epcrRecordRepository.findById(s.getRecordId()).orElse(null);
        }

        return ShareResponse.builder()
                .id(s.getId())
                .recordId(s.getRecordId())
                .patientId(s.getPatientId())
                .organizationId(s.getOrganizationId())
                .organizationName(organizationName)
                .sharedByName(s.getSharedByName())
                .shareType(s.getShareType())
                .status(s.getStatus())
                .specialistName(specialistName)
                .specialistEmail(includeSensitive ? phiCryptoService.decrypt(s.getSpecialistEmail()) : null)
                .specialtyRequested(s.getSpecialtyRequested())
                .includeFullEpcr(s.isIncludeFullEpcr())
                .includedDocumentIds(s.getIncludedDocumentIds())
                .includedLabResultIds(s.getIncludedLabResultIds())
                .clinicalQuestion(phiCryptoService.decrypt(s.getClinicalQuestion()))
                .responseNotes(phiCryptoService.decrypt(s.getResponseNotes()))
                .epcrRecord(epcrRecordData)
                .expiresAt(s.getExpiresAt())
                .viewedAt(s.getViewedAt())
                .createdAt(s.getCreatedAt())
                .build();
    }
}
