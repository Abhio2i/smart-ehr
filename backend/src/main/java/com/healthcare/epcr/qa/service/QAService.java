package com.healthcare.epcr.qa.service;

import com.healthcare.epcr.common.exception.ResourceNotFoundException;
import com.healthcare.epcr.epcr.enums.RecordStatus;
import com.healthcare.epcr.epcr.model.PatientCareRecord;
import com.healthcare.epcr.epcr.repository.PatientCareRecordRepository;
import com.healthcare.epcr.notification.model.Notification;
import com.healthcare.epcr.notification.service.NotificationService;
import com.healthcare.epcr.phi.crypto.PhiCryptoService;
import com.healthcare.epcr.qa.dto.QAReviewDTO;
import com.healthcare.epcr.qa.model.QAForm;
import com.healthcare.epcr.qa.model.QAReview;
import com.healthcare.epcr.qa.repository.QAFormRepository;
import com.healthcare.epcr.qa.repository.QAReviewRepository;
import com.healthcare.epcr.security.AccessControlService;
import com.healthcare.epcr.user.repository.UserRepository;
import com.healthcare.epcr.user.model.User;
import com.healthcare.epcr.common.dto.PageResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import com.healthcare.epcr.billing.service.BillingClaimsService;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.time.LocalDateTime;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.Map;
import java.util.HashMap;
import java.util.function.Function;
import java.util.stream.Collectors;
import com.healthcare.epcr.followup.service.FollowUpTaskService;

@Service
@RequiredArgsConstructor
@Slf4j
public class QAService {

    private final QAFormRepository qaFormRepository;
    private final QAReviewRepository qaReviewRepository;
    private final PatientCareRecordRepository patientCareRecordRepository;
    private final AccessControlService accessControlService;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final PhiCryptoService phiCryptoService;
    private final MongoTemplate mongoTemplate;
    private final FollowUpTaskService followUpTaskService;
    private final BillingClaimsService billingClaimsService;

    private static final int MAX_REVIEW_PAGE_SIZE = 200;
    private static final Set<String> ALLOWED_REVIEW_SORT_FIELDS = Set.of(
            "createdAt", "updatedAt", "completedAt", "status", "score", "reviewerId", "patientCareRecordId"
    );

    public QAForm createQAForm(QAForm form) {
        if (form.getOrganizationId() != null) {
            accessControlService.assertOrganizationAccess(form.getOrganizationId());
        }
        form.setCreatedAt(LocalDateTime.now());
        form.setUpdatedAt(LocalDateTime.now());
        if (form.getActive() == null) {
            form.setActive(true);
        }
        return qaFormRepository.save(form);
    }

    public Optional<QAForm> getQAFormById(String id) {
        return qaFormRepository.findById(id)
                .filter(form -> accessControlService.canAccessOrganization(form.getOrganizationId()));
    }

    public List<QAForm> getQAFormsByOrganization(String organizationId) {
        accessControlService.assertOrganizationAccess(organizationId);
        return qaFormRepository.findByOrganizationId(organizationId);
    }

    public QAForm updateQAForm(String id, QAForm form) {
        QAForm existing = qaFormRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("QA form not found with id: " + id));
        accessControlService.assertOrganizationAccess(existing.getOrganizationId());

        form.setId(existing.getId());
        form.setCreatedAt(existing.getCreatedAt());
        form.setUpdatedAt(LocalDateTime.now());
        return qaFormRepository.save(form);
    }

    public QAReview createQAReview(QAReview review) {
        User currentUser = accessControlService.currentUser();
        String recordOrgId = patientCareRecordRepository.findById(review.getPatientCareRecordId())
                .map(r -> r.getOrganizationId())
                .orElseThrow(() -> new ResourceNotFoundException("Patient care record not found: " + review.getPatientCareRecordId()));
        accessControlService.assertOrganizationAccess(recordOrgId);
        review.setReviewerId(currentUser.getId());
        review.setCreatedAt(LocalDateTime.now());
        review.setUpdatedAt(LocalDateTime.now());
        review.setStatus(normalizeQaStatus(review.getStatus()));
        return qaReviewRepository.save(review);
    }

    public Optional<QAReview> getQAReviewById(String id) {
        return qaReviewRepository.findById(id).filter(this::canAccessReview);
    }

    public List<QAReview> getAllQAReviews() {
        ensurePendingReviewsBackfilled();
        return qaReviewRepository.findAll().stream().filter(this::canAccessReview).collect(Collectors.toList());
    }

    public List<QAReview> getQAReviewsByRecord(String patientCareRecordId) {
        ensurePendingReviewForRecord(patientCareRecordId);
        return qaReviewRepository.findByPatientCareRecordId(patientCareRecordId)
                .stream().filter(this::canAccessReview).collect(Collectors.toList());
    }

    public List<QAReview> getQAReviewsByReviewer(String reviewerId) {
        User currentUser = accessControlService.currentUser();
        if (!accessControlService.isSystemWideQaUser(currentUser)
                && (reviewerId == null || !reviewerId.equals(currentUser.getId()))) {
            throw new IllegalArgumentException("Access denied for reviewerId: " + reviewerId);
        }
        return qaReviewRepository.findByReviewerId(reviewerId)
                .stream().filter(this::canAccessReview).collect(Collectors.toList());
    }

    public List<QAReview> getPendingReviews() {
        ensurePendingReviewsBackfilled();
        return qaReviewRepository.findAll().stream()
                .filter(review -> "QA_PENDING".equals(normalizeQaStatus(review.getStatus())))
                .filter(this::canAccessReview)
                .collect(Collectors.toList());
    }

    public QAReview completeQAReview(String id, QAReview review) {
        User currentUser = accessControlService.currentUser();
        QAReview existing = qaReviewRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("QA review not found with id: " + id));
        if (!canAccessReview(existing)) {
            throw new IllegalArgumentException("Access denied for QA review: " + id);
        }

        existing.setResponses(review.getResponses());
        existing.setScore(review.getScore());
        existing.setPassed(review.getPassed());
        existing.setFeedback(review.getFeedback());
        existing.setReviewerId(currentUser.getId());
        existing.setStatus("QA_COMPLETED");
        existing.setCompletedAt(LocalDateTime.now());
        existing.setUpdatedAt(LocalDateTime.now());
        QAReview savedReview = qaReviewRepository.save(existing);

        PatientCareRecord record = patientCareRecordRepository.findById(existing.getPatientCareRecordId())
                .orElseThrow(() -> new ResourceNotFoundException("Patient care record not found: " + existing.getPatientCareRecordId()));
        if (Boolean.TRUE.equals(existing.getPassed())) {
            record.setStatus(RecordStatus.APPROVED);
            record.setQaApproved(true);
            record.setQaApprovedAt(LocalDateTime.now());
            record.setQaApprovedBy(currentUser.getId());
            try {
                billingClaimsService.generateClaimFromRecord(record.getId());
            } catch (Exception e) {
                log.error("Failed to auto-generate billing claim for record {}: {}", record.getId(), e.getMessage());
            }
        } else {
            record.setStatus(RecordStatus.REJECTED);
            record.setQaApproved(false);
            record.setQaApprovedAt(null);
            record.setQaApprovedBy(null);
        }
        record.setFeedback(review.getFeedback());
        record.setUpdatedAt(LocalDateTime.now());
        patientCareRecordRepository.save(record);
        followUpTaskService.scheduleIfCritical(record);
        createQaCompletionNotifications(savedReview, record, currentUser);

        return savedReview;
    }

    public void deleteQAReview(String id) {
        if (!qaReviewRepository.existsById(id)) {
            throw new ResourceNotFoundException("QA review not found with id: " + id);
        }
        QAReview existing = qaReviewRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("QA review not found with id: " + id));
        if (!canAccessReview(existing)) {
            throw new IllegalArgumentException("Access denied for QA review: " + id);
        }
        qaReviewRepository.deleteById(id);
    }

    public QAReviewDTO mapToDTO(QAReview review) {
        return mapToDTO(review, null, null);
    }

    public QAReviewDTO mapToDTO(
            QAReview review,
            Map<String, PatientCareRecord> recordCache,
            Map<String, User> userCache) {
        if (review == null) {
            return null;
        }
        String normalizedStatus = normalizeQaStatus(review.getStatus());
        Double normalizedScore = isPendingStatus(normalizedStatus) ? null : roundScore(review.getScore());
        String scoreDisplay = normalizedScore == null ? "—" : stripTrailingZeros(normalizedScore) + "%";

        List<QAReviewDTO.QAResponseDTO> responseDTOS = review.getResponses() == null
                ? Collections.emptyList()
                : review.getResponses().stream()
                .map(response -> new QAReviewDTO.QAResponseDTO(response.getQuestionId(), response.getAnswer()))
                .collect(Collectors.toList());

        String recordDisplay = review.getPatientCareRecordId();
        PatientCareRecord record = recordCache != null ? recordCache.get(review.getPatientCareRecordId()) : null;
        if (record == null && patientCareRecordRepository != null) {
            record = patientCareRecordRepository.findById(review.getPatientCareRecordId()).orElse(null);
        }
        if (record != null) {
            String decryptedName = phiCryptoService.decrypt(record.getPatientName());
            String patientName = decryptedName == null || decryptedName.isBlank()
                    ? "Unknown Patient"
                    : decryptedName;
            recordDisplay = patientName + " (" + record.getId() + ")";
        }

        String reviewerName = review.getReviewerId();
        String reviewerEmail = null;
        if (review.getReviewerId() != null && !review.getReviewerId().isBlank()) {
            User reviewer = userCache != null ? userCache.get(review.getReviewerId()) : null;
            if (reviewer == null && userRepository != null) {
                reviewer = userRepository.findById(review.getReviewerId()).orElse(null);
            }
            if (reviewer != null) {
                String fullName = ((reviewer.getFirstName() == null ? "" : reviewer.getFirstName().trim()) + " "
                        + (reviewer.getLastName() == null ? "" : reviewer.getLastName().trim())).trim();
                reviewerName = fullName.isBlank() ? reviewer.getEmail() : fullName;
                reviewerEmail = reviewer.getEmail();
            }
        }

        return new QAReviewDTO(
                review.getId(),
                review.getPatientCareRecordId(),
                recordDisplay,
                review.getQaFormId(),
                review.getReviewerId(),
                reviewerName,
                reviewerEmail,
                responseDTOS,
                normalizedScore,
                scoreDisplay,
                review.getPassed(),
                review.getFeedback(),
                normalizedStatus,
                review.getCreatedAt(),
                review.getUpdatedAt(),
                review.getCompletedAt()
        );
    }

    public List<QAReviewDTO> mapToDTOList(List<QAReview> reviews) {
        if (reviews == null || reviews.isEmpty()) {
            return Collections.emptyList();
        }

        Set<String> recordIds = reviews.stream()
                .map(QAReview::getPatientCareRecordId)
                .filter(id -> id != null && !id.isBlank())
                .collect(Collectors.toSet());

        Set<String> reviewerIds = reviews.stream()
                .map(QAReview::getReviewerId)
                .filter(id -> id != null && !id.isBlank())
                .collect(Collectors.toSet());

        Map<String, PatientCareRecord> recordCache = recordIds.isEmpty()
                ? Collections.emptyMap()
                : patientCareRecordRepository.findAllById(recordIds).stream()
                        .collect(Collectors.toMap(PatientCareRecord::getId, Function.identity(), (a, b) -> a));

        Map<String, User> userCache = reviewerIds.isEmpty()
                ? Collections.emptyMap()
                : userRepository.findAllById(reviewerIds).stream()
                        .collect(Collectors.toMap(User::getId, Function.identity(), (a, b) -> a));

        return reviews.stream()
                .map(review -> mapToDTO(review, recordCache, userCache))
                .collect(Collectors.toList());
    }

    public List<QAReview> getReviews(String filter, String reviewerId) {
        if ("mine".equalsIgnoreCase(filter)) {
            return getQAReviewsByReviewer(reviewerId);
        } else if ("pending".equalsIgnoreCase(filter)) {
            return getPendingReviews();
        } else {
            return getAllQAReviews();
        }
    }

    public PageResponse<QAReviewDTO> getReviewsPaginated(String filter, String reviewerId, int page, int size) {
        return searchReviews(filter, null, null, reviewerId, null, null, null, page, size, "updatedAt", "desc");
    }

    public PageResponse<QAReviewDTO> searchReviews(
            String filter,
            String status,
            String queryText,
            String reviewerId,
            String organizationId,
            LocalDateTime fromDate,
            LocalDateTime toDate,
            int page,
            int size,
            String sortBy,
            String sortDirection) {
        ensurePendingReviewsBackfilled();

        User currentUser = accessControlService.currentUser();
        int resolvedPage = Math.max(page, 0);
        int resolvedSize = Math.min(Math.max(size, 1), MAX_REVIEW_PAGE_SIZE);
        Sort sort = buildReviewSort(sortBy, sortDirection);

        Query query = new Query();
        List<Criteria> criteria = new ArrayList<>();

        Set<String> accessibleRecordIds = resolveAccessibleRecordIds(currentUser, organizationId);
        if (accessibleRecordIds != null) {
            if (accessibleRecordIds.isEmpty()) {
                return new PageResponse<>(List.of(), resolvedPage, resolvedSize, 0, 0, true);
            }
            criteria.add(Criteria.where("patientCareRecordId").in(accessibleRecordIds));
        }

        List<String> statuses = resolveStatusFilter(filter, status);
        if (!statuses.isEmpty()) {
            criteria.add(Criteria.where("status").in(statuses));
        }

        String resolvedReviewerId = resolveReviewerFilter(filter, reviewerId, currentUser);
        if (resolvedReviewerId != null && !resolvedReviewerId.isBlank()) {
            criteria.add(Criteria.where("reviewerId").is(resolvedReviewerId));
        }

        if (fromDate != null || toDate != null) {
            Criteria dateCriteria = Criteria.where("createdAt");
            if (fromDate != null) {
                dateCriteria = dateCriteria.gte(fromDate);
            }
            if (toDate != null) {
                dateCriteria = dateCriteria.lte(toDate);
            }
            criteria.add(dateCriteria);
        }

        String normalizedQuery = queryText == null ? null : queryText.trim();
        if (normalizedQuery != null && !normalizedQuery.isBlank()) {
            String regex = ".*" + java.util.regex.Pattern.quote(normalizedQuery) + ".*";
            List<Criteria> queryCriteria = new ArrayList<>(List.of(
                    Criteria.where("_id").regex(regex, "i"),
                    Criteria.where("patientCareRecordId").regex(regex, "i"),
                    Criteria.where("qaFormId").regex(regex, "i"),
                    Criteria.where("reviewerId").regex(regex, "i"),
                    Criteria.where("feedback").regex(regex, "i"),
                    Criteria.where("status").regex(regex, "i")
            ));
            Set<String> matchingRecordIds = resolveRecordIdsForQuery(currentUser, organizationId, normalizedQuery);
            if (!matchingRecordIds.isEmpty()) {
                queryCriteria.add(Criteria.where("patientCareRecordId").in(matchingRecordIds));
            }
            criteria.add(new Criteria().orOperator(queryCriteria.toArray(new Criteria[0])));
        }

        if (!criteria.isEmpty()) {
            query.addCriteria(new Criteria().andOperator(criteria.toArray(new Criteria[0])));
        }

        long total = mongoTemplate.count(query, QAReview.class);
        query.with(PageRequest.of(resolvedPage, resolvedSize, sort));
        
        List<QAReview> reviewsList = mongoTemplate.find(query, QAReview.class).stream()
                .filter(this::canAccessReview)
                .toList();
        List<QAReviewDTO> content = mapToDTOList(reviewsList);

        int totalPages = total == 0 ? 0 : (int) Math.ceil((double) total / resolvedSize);
        boolean last = totalPages == 0 || resolvedPage >= totalPages - 1;
        return new PageResponse<>(content, resolvedPage, resolvedSize, total, totalPages, last);
    }

    public PageResponse<QAReviewDTO> getAllReviewsPaginated(int page, int size) {
        ensurePendingReviewsBackfilled();
        var pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "updatedAt"));
        var reviewsPage = qaReviewRepository.findAllBy(pageable);
        var filteredReviews = reviewsPage.getContent().stream()
                .filter(this::canAccessReview)
                .toList();
        var filtered = mapToDTOList(filteredReviews);
        return new PageResponse<>(
                filtered,
                page,
                size,
                reviewsPage.getTotalElements(),
                reviewsPage.getTotalPages(),
                reviewsPage.isLast()
        );
    }

    public PageResponse<QAReviewDTO> getReviewsByReviewerPaginated(String reviewerId, int page, int size) {
        ensurePendingReviewsBackfilled();
        User currentUser = accessControlService.currentUser();
        if (!accessControlService.isSystemWideQaUser(currentUser)
                && (reviewerId == null || !reviewerId.equals(currentUser.getId()))) {
            throw new IllegalArgumentException("Access denied for reviewerId: " + reviewerId);
        }
        var pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "updatedAt"));
        var reviewsPage = qaReviewRepository.findByReviewerId(reviewerId, pageable);
        var filteredReviews = reviewsPage.getContent().stream()
                .filter(this::canAccessReview)
                .toList();
        var filtered = mapToDTOList(filteredReviews);
        return new PageResponse<>(
                filtered,
                page,
                size,
                reviewsPage.getTotalElements(),
                reviewsPage.getTotalPages(),
                reviewsPage.isLast()
        );
    }

    public PageResponse<QAReviewDTO> getPendingReviewsPaginated(int page, int size) {
        ensurePendingReviewsBackfilled();
        var pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "updatedAt"));
        var reviewsPage = qaReviewRepository.findByStatusIn(List.of("PENDING", "QA_PENDING"), pageable);
        var filteredReviews = reviewsPage.getContent().stream()
                .filter(this::canAccessReview)
                .toList();
        var filtered = mapToDTOList(filteredReviews);
        return new PageResponse<>(
                filtered,
                page,
                size,
                reviewsPage.getTotalElements(),
                reviewsPage.getTotalPages(),
                reviewsPage.isLast()
        );
    }

    private Set<String> resolveAccessibleRecordIds(User currentUser, String organizationId) {
        String scopedOrganizationId = null;
        if (organizationId != null && !organizationId.isBlank()) {
            accessControlService.assertOrganizationAccess(organizationId);
            scopedOrganizationId = organizationId;
        } else if (currentUser.getRole() != com.healthcare.epcr.user.model.Role.ADMIN) {
            scopedOrganizationId = currentUser.getOrganizationId();
        }

        if (scopedOrganizationId == null) {
            return null;
        }

        Query recordQuery = new Query();
        recordQuery.addCriteria(Criteria.where("organizationId").is(scopedOrganizationId));
        recordQuery.fields().include("_id");

        return mongoTemplate.find(recordQuery, PatientCareRecord.class).stream()
                .map(PatientCareRecord::getId)
                .filter(id -> id != null && !id.isBlank())
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private Set<String> resolveRecordIdsForQuery(User currentUser, String organizationId, String queryText) {
        if (queryText == null || queryText.isBlank()) {
            return Set.of();
        }
        String scopedOrganizationId = null;
        if (organizationId != null && !organizationId.isBlank()) {
            accessControlService.assertOrganizationAccess(organizationId);
            scopedOrganizationId = organizationId;
        } else if (currentUser.getRole() != com.healthcare.epcr.user.model.Role.ADMIN) {
            scopedOrganizationId = currentUser.getOrganizationId();
        }

        String regex = ".*" + java.util.regex.Pattern.quote(queryText.trim()) + ".*";
        List<Criteria> recordCriteria = new ArrayList<>();
        if (scopedOrganizationId != null && !scopedOrganizationId.isBlank()) {
            recordCriteria.add(Criteria.where("organizationId").is(scopedOrganizationId));
        }
        recordCriteria.add(new Criteria().orOperator(
                Criteria.where("_id").regex(regex, "i"),
                Criteria.where("patientId").regex(regex, "i"),
                Criteria.where("incidentNumber").regex(regex, "i"),
                Criteria.where("incidentType").regex(regex, "i"),
                Criteria.where("incidentLocation").regex(regex, "i"),
                Criteria.where("diagnosis").regex(regex, "i"),
                Criteria.where("primaryImpression").regex(regex, "i"),
                Criteria.where("secondaryImpression").regex(regex, "i")
        ));

        Query recordQuery = new Query();
        recordQuery.addCriteria(new Criteria().andOperator(recordCriteria.toArray(new Criteria[0])));
        recordQuery.fields().include("_id");

        return mongoTemplate.find(recordQuery, PatientCareRecord.class).stream()
                .map(PatientCareRecord::getId)
                .filter(id -> id != null && !id.isBlank())
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private List<String> resolveStatusFilter(String filter, String status) {
        String requested = status;
        if ((requested == null || requested.isBlank()) && filter != null && !filter.isBlank()
                && !"mine".equalsIgnoreCase(filter) && !"all".equalsIgnoreCase(filter)) {
            requested = filter;
        }
        if (requested == null || requested.isBlank() || "all".equalsIgnoreCase(requested)) {
            return List.of();
        }

        String normalized = normalizeQaStatus(requested);
        return switch (normalized) {
            case "QA_PENDING" -> List.of("PENDING", "QA_PENDING", "DRAFT", "SUBMITTED");
            case "QA_COMPLETED" -> List.of("COMPLETED", "QA_COMPLETED", "DONE");
            case "APPROVED" -> List.of("APPROVED");
            case "REJECTED" -> List.of("REJECTED");
            default -> throw new IllegalArgumentException("Unsupported QA review status: " + requested);
        };
    }

    private String resolveReviewerFilter(String filter, String reviewerId, User currentUser) {
        String resolvedReviewerId = reviewerId;
        if ("mine".equalsIgnoreCase(filter)) {
            resolvedReviewerId = currentUser.getId();
        }
        if (resolvedReviewerId == null || resolvedReviewerId.isBlank()) {
            return null;
        }
        if (!accessControlService.isSystemWideQaUser(currentUser)
                && currentUser.getRole() != com.healthcare.epcr.user.model.Role.ADMIN
                && !resolvedReviewerId.equals(currentUser.getId())) {
            throw new IllegalArgumentException("Access denied for reviewerId: " + resolvedReviewerId);
        }
        return resolvedReviewerId;
    }

    private Sort buildReviewSort(String sortBy, String sortDirection) {
        String resolvedSortBy = sortBy == null || sortBy.isBlank() ? "updatedAt" : sortBy.trim();
        if (!ALLOWED_REVIEW_SORT_FIELDS.contains(resolvedSortBy)) {
            throw new IllegalArgumentException("Unsupported QA review sortBy: " + resolvedSortBy);
        }
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDirection)
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;
        return Sort.by(direction, resolvedSortBy);
    }

    public java.util.Map<String, Long> getReviewStats() {
        User currentUser = accessControlService.currentUser();
        boolean isGlobal = currentUser.getRole() == com.healthcare.epcr.user.model.Role.ADMIN
                || accessControlService.isSystemWideQaUser(currentUser);

        List<QAReview> reviews;
        if (isGlobal) {
            reviews = qaReviewRepository.findAll().stream()
                    .filter(this::canAccessReview)
                    .toList();
        } else {
            String orgId = currentUser.getOrganizationId();
            List<String> recordIds = patientCareRecordRepository.findByOrganizationId(orgId).stream()
                    .map(PatientCareRecord::getId)
                    .filter(id -> id != null && !id.isBlank())
                    .toList();
            if (recordIds.isEmpty()) {
                return java.util.Map.of("total", 0L, "pending", 0L, "completed", 0L);
            }
            reviews = qaReviewRepository.findByPatientCareRecordIdIn(recordIds);
        }

        long total = reviews.size();
        long pending = 0;
        long completed = 0;

        for (QAReview r : reviews) {
            String status = normalizeQaStatus(r.getStatus());
            if ("QA_PENDING".equals(status)) {
                pending++;
            } else if ("QA_COMPLETED".equals(status) || "APPROVED".equals(status) || "REJECTED".equals(status)) {
                completed++;
            }
        }

        return java.util.Map.of("total", total, "pending", pending, "completed", completed);
    }

    private String normalizeQaStatus(String status) {
        if (status == null || status.isBlank()) {
            return "QA_PENDING";
        }
        String normalized = status.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "PENDING", "QA_PENDING", "DRAFT", "SUBMITTED" -> "QA_PENDING";
            case "COMPLETED", "QA_COMPLETED", "DONE" -> "QA_COMPLETED";
            case "APPROVED" -> "APPROVED";
            case "REJECTED" -> "REJECTED";
            default -> normalized;
        };
    }

    private boolean canAccessReview(QAReview review) {
        if (review == null || review.getPatientCareRecordId() == null) {
            return false;
        }
        return patientCareRecordRepository.findById(review.getPatientCareRecordId())
                .map(record -> accessControlService.canAccessOrganization(record.getOrganizationId()))
                .orElse(false);
    }

    private boolean isPendingStatus(String normalizedStatus) {
        return "QA_PENDING".equals(normalizedStatus);
    }

    private Double roundScore(Double score) {
        if (score == null) {
            return null;
        }
        return BigDecimal.valueOf(score).setScale(1, RoundingMode.HALF_UP).doubleValue();
    }

    private String stripTrailingZeros(Double score) {
        if (score == null) {
            return null;
        }
        BigDecimal value = BigDecimal.valueOf(score).stripTrailingZeros();
        return value.scale() < 0 ? value.setScale(0).toPlainString() : value.toPlainString();
    }

    private void ensurePendingReviewsBackfilled() {
        List<PatientCareRecord> pendingRecords = patientCareRecordRepository.findByStatusAndQaApproved(
                RecordStatus.SUBMITTED, false);

        if (pendingRecords == null || pendingRecords.isEmpty()) {
            return;
        }

        List<String> recordIds = pendingRecords.stream()
                .map(PatientCareRecord::getId)
                .filter(id -> id != null && !id.isBlank())
                .collect(Collectors.toList());

        if (recordIds.isEmpty()) {
            return;
        }

        List<QAReview> existingReviews = qaReviewRepository.findByPatientCareRecordIdIn(recordIds);
        Set<String> existingRecordIds = existingReviews.stream()
                .map(QAReview::getPatientCareRecordId)
                .filter(id -> id != null && !id.isBlank())
                .collect(Collectors.toSet());

        for (PatientCareRecord record : pendingRecords) {
            if (record != null && record.getId() != null && !record.getId().isBlank()) {
                if (!existingRecordIds.contains(record.getId())) {
                    createPendingReviewForRecord(record);
                }
            }
        }
    }

    private void ensurePendingReviewForRecord(String patientCareRecordId) {
        if (patientCareRecordId == null || patientCareRecordId.isBlank()) {
            return;
        }
        boolean exists = qaReviewRepository.existsByPatientCareRecordId(patientCareRecordId);
        if (exists) {
            return;
        }
        patientCareRecordRepository.findById(patientCareRecordId)
                .filter(record -> record.getStatus() == RecordStatus.SUBMITTED && Boolean.FALSE.equals(record.getQaApproved()))
                .ifPresent(this::createPendingReviewForRecord);
    }

    private void createPendingReviewForRecord(PatientCareRecord record) {
        if (record == null || record.getId() == null || record.getId().isBlank()) {
            return;
        }
        String qaFormId = qaFormRepository.findByOrganizationId(record.getOrganizationId()).stream()
                .filter(form -> Boolean.TRUE.equals(form.getActive()))
                .map(QAForm::getId)
                .findFirst()
                .orElseGet(() -> qaFormRepository.findByActive(true).stream()
                        .map(QAForm::getId)
                        .findFirst()
                        .orElse(null));

        QAReview pendingReview = new QAReview();
        pendingReview.setPatientCareRecordId(record.getId());
        pendingReview.setQaFormId(qaFormId);
        pendingReview.setReviewerId(null);
        pendingReview.setResponses(Collections.emptyList());
        pendingReview.setScore(null);
        pendingReview.setPassed(null);
        pendingReview.setFeedback("Auto-created from submitted EPCR");
        pendingReview.setStatus("QA_PENDING");
        pendingReview.setCreatedAt(LocalDateTime.now());
        pendingReview.setUpdatedAt(LocalDateTime.now());
        pendingReview.setCompletedAt(null);
        qaReviewRepository.save(pendingReview);
    }

    private void createQaCompletionNotifications(QAReview review, PatientCareRecord record, User reviewer) {
        Set<String> recipientIds = new LinkedHashSet<>();
        addRecipient(recipientIds, record.getSubmittedBy());
        addRecipient(recipientIds, record.getParamedicsId());
        addRecipient(recipientIds, reviewer.getId());

        for (String recipientId : recipientIds) {
            Notification notification = new Notification();
            notification.setRecipientId(recipientId);
            notification.setType(Boolean.TRUE.equals(review.getPassed()) ? "SUCCESS" : "WARNING");
            notification.setTitle(Boolean.TRUE.equals(review.getPassed()) ? "QA Review Passed" : "QA Review Failed");
            notification.setMessage(buildQaCompletionMessage(record, review));
            notification.setRelatedEntityId(record.getId());
            notification.setRelatedEntityType("PatientCareRecord");
            notificationService.createNotification(notification);
        }
    }

    private void addRecipient(Set<String> recipientIds, String recipientId) {
        if (recipientId != null && !recipientId.isBlank() && userRepository.existsById(recipientId)) {
            recipientIds.add(recipientId);
        }
    }

    private String buildQaCompletionMessage(PatientCareRecord record, QAReview review) {
        String recordLabel = record.getIncidentNumber() == null || record.getIncidentNumber().isBlank()
                ? record.getId()
                : record.getIncidentNumber();
        String patientName = phiCryptoService.decrypt(record.getPatientName());
        if (patientName == null || patientName.isBlank()) {
            patientName = "Anonymous Patient";
        }
        String outcome = Boolean.TRUE.equals(review.getPassed()) ? "passed" : "failed";
        String score = review.getScore() == null ? "not scored" : "scored " + stripTrailingZeros(roundScore(review.getScore())) + "/100";
        String feedback = review.getFeedback() == null || review.getFeedback().isBlank()
                ? ""
                : " Feedback: " + review.getFeedback().trim();
        return "The QA review for patient " + patientName + " (Record #" + recordLabel + ") has " + outcome + " with a score of " + score + "." + feedback;
    }
}
