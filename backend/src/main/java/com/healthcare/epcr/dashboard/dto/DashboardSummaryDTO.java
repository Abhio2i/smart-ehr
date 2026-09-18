package com.healthcare.epcr.dashboard.dto;

import com.healthcare.epcr.epcr.enums.RecordStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardSummaryDTO {
    private RecordSummary records;
    private QaSummary qa;
    private NotificationSummary notifications;
    private List<RecentRecord> recentRecords;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RecordSummary {
        private long total;
        private long drafts;
        private long inProgress;
        private long completed;
        private long submitted;
        private long approved;
        private long rejected;
        private long archived;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QaSummary {
        private long totalReviews;
        private long pending;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class NotificationSummary {
        private long unreadCount;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RecentRecord {
        private String id;
        private String incidentNumber;
        private String patientName;
        private String incidentLocation;
        private RecordStatus status;
        private LocalDateTime updatedAt;
        private LocalDateTime submittedAt;
    }
}
