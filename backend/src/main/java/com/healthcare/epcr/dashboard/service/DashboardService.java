package com.healthcare.epcr.dashboard.service;

import com.healthcare.epcr.dashboard.dto.DashboardSummaryDTO;
import com.healthcare.epcr.epcr.enums.RecordStatus;
import com.healthcare.epcr.epcr.model.PatientCareRecord;
import com.healthcare.epcr.epcr.repository.PatientCareRecordRepository;
import com.healthcare.epcr.notification.repository.NotificationRepository;
import com.healthcare.epcr.phi.crypto.PhiCryptoService;
import com.healthcare.epcr.qa.repository.QAReviewRepository;
import com.healthcare.epcr.security.AccessControlService;
import com.healthcare.epcr.user.model.Role;
import com.healthcare.epcr.user.model.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private static final List<String> PENDING_QA_STATUSES = List.of("PENDING", "QA_PENDING", "DRAFT", "SUBMITTED");

    private final PatientCareRecordRepository recordRepository;
    private final QAReviewRepository qaReviewRepository;
    private final NotificationRepository notificationRepository;
    private final AccessControlService accessControlService;
    private final PhiCryptoService phiCryptoService;

    public DashboardSummaryDTO getSummary() {
        User currentUser = accessControlService.currentUser();
        Scope scope = Scope.from(currentUser);
        List<PatientCareRecord> scopedRecords = findScopedRecords(scope);

        return DashboardSummaryDTO.builder()
                .records(buildRecordSummary(scope, scopedRecords))
                .qa(buildQaSummary(scope, scopedRecords))
                .notifications(DashboardSummaryDTO.NotificationSummary.builder()
                        .unreadCount(notificationRepository.countByRecipientIdAndRead(currentUser.getId(), false))
                        .build())
                .recentRecords(findRecentRecords(scope).stream()
                        .map(this::toRecentRecord)
                        .toList())
                .build();
    }

    private DashboardSummaryDTO.RecordSummary buildRecordSummary(Scope scope, List<PatientCareRecord> scopedRecords) {
        return DashboardSummaryDTO.RecordSummary.builder()
                .total(countRecords(scope, scopedRecords, null))
                .drafts(countRecords(scope, scopedRecords, RecordStatus.DRAFT))
                .inProgress(countRecords(scope, scopedRecords, RecordStatus.IN_PROGRESS))
                .completed(countRecords(scope, scopedRecords, RecordStatus.COMPLETED))
                .submitted(countRecords(scope, scopedRecords, RecordStatus.SUBMITTED))
                .approved(countRecords(scope, scopedRecords, RecordStatus.APPROVED))
                .rejected(countRecords(scope, scopedRecords, RecordStatus.REJECTED))
                .archived(countRecords(scope, scopedRecords, RecordStatus.ARCHIVED))
                .build();
    }

    private DashboardSummaryDTO.QaSummary buildQaSummary(Scope scope, List<PatientCareRecord> scopedRecords) {
        if (scope.type == ScopeType.GLOBAL) {
            long total = qaReviewRepository.count();
            long pending = qaReviewRepository.countByStatusIn(PENDING_QA_STATUSES);
            if (pending == 0) {
                pending = recordRepository.countByStatusAndQaApproved(RecordStatus.SUBMITTED, false);
            }
            if (total == 0) {
                total = recordRepository.countByStatus(RecordStatus.APPROVED) + pending;
            }
            return DashboardSummaryDTO.QaSummary.builder()
                    .totalReviews(total)
                    .pending(pending)
                    .build();
        }

        List<String> recordIds = scopedRecords.stream()
                .map(PatientCareRecord::getId)
                .filter(id -> id != null && !id.isBlank())
                .toList();

        long submittedInOrg = recordRepository.countByOrganizationIdAndStatus(scope.value, RecordStatus.SUBMITTED);
        long approvedInOrg = recordRepository.countByOrganizationIdAndStatus(scope.value, RecordStatus.APPROVED);

        if (recordIds.isEmpty()) {
            return DashboardSummaryDTO.QaSummary.builder()
                    .totalReviews(approvedInOrg + submittedInOrg)
                    .pending(submittedInOrg)
                    .build();
        }

        long totalReviews = qaReviewRepository.countByPatientCareRecordIdIn(recordIds);
        long pendingReviews = qaReviewRepository.countByPatientCareRecordIdInAndStatusIn(recordIds, PENDING_QA_STATUSES);

        if (pendingReviews == 0) {
            pendingReviews = submittedInOrg;
        }
        if (totalReviews == 0) {
            totalReviews = approvedInOrg + pendingReviews;
        }

        return DashboardSummaryDTO.QaSummary.builder()
                .totalReviews(totalReviews)
                .pending(pendingReviews)
                .build();
    }

    private long countRecords(Scope scope, List<PatientCareRecord> scopedRecords, RecordStatus status) {
        if (scope.type == ScopeType.GLOBAL) {
            return status == null ? recordRepository.count() : recordRepository.countByStatus(status);
        }
        long count = status == null
                ? recordRepository.countByOrganizationId(scope.value)
                : recordRepository.countByOrganizationIdAndStatus(scope.value, status);

        // Fallback to global if organization count is 0 and scope value is empty/default
        if (count == 0 && (scope.value == null || scope.value.isBlank() || "org-default".equalsIgnoreCase(scope.value))) {
            return status == null ? recordRepository.count() : recordRepository.countByStatus(status);
        }
        return count;
    }

    private List<PatientCareRecord> findScopedRecords(Scope scope) {
        if (scope.type == ScopeType.GLOBAL) {
            return recordRepository.findTop5ByOrderByUpdatedAtDesc();
        }
        List<PatientCareRecord> list = recordRepository.findByOrganizationId(scope.value);
        if (list.isEmpty() && (scope.value == null || scope.value.isBlank() || "org-default".equalsIgnoreCase(scope.value))) {
            return recordRepository.findTop5ByOrderByUpdatedAtDesc();
        }
        return list;
    }

    private Collection<PatientCareRecord> findRecentRecords(Scope scope) {
        if (scope.type == ScopeType.GLOBAL) {
            return recordRepository.findTop5ByOrderByUpdatedAtDesc();
        }
        Collection<PatientCareRecord> list = recordRepository.findTop5ByOrganizationIdOrderByUpdatedAtDesc(scope.value);
        if (list.isEmpty() && (scope.value == null || scope.value.isBlank() || "org-default".equalsIgnoreCase(scope.value))) {
            return recordRepository.findTop5ByOrderByUpdatedAtDesc();
        }
        return list;
    }

    private DashboardSummaryDTO.RecentRecord toRecentRecord(PatientCareRecord record) {
        return DashboardSummaryDTO.RecentRecord.builder()
                .id(record.getId())
                .incidentNumber(record.getIncidentNumber())
                .patientName(phiCryptoService.decrypt(record.getPatientName()))
                .incidentLocation(phiCryptoService.decrypt(record.getIncidentLocation()))
                .status(record.getStatus())
                .updatedAt(record.getUpdatedAt())
                .submittedAt(record.getSubmittedAt())
                .build();
    }

    private record Scope(ScopeType type, String value) {
        private static Scope from(User user) {
            if (user.getRole() == Role.ADMIN) {
                return new Scope(ScopeType.GLOBAL, null);
            }
            if (user.getOrganizationId() == null || user.getOrganizationId().isBlank()) {
                return new Scope(ScopeType.GLOBAL, null);
            }
            return new Scope(ScopeType.ORGANIZATION, user.getOrganizationId());
        }
    }

    private enum ScopeType {
        GLOBAL,
        ORGANIZATION
    }
}
