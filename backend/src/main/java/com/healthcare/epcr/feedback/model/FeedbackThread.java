package com.healthcare.epcr.feedback.model;

import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.annotation.Id;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "feedback_threads")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FeedbackThread {
    @Id
    private String id;
    private String patientCareRecordId;
    private String organizationId;
    private String initiatedBy;
    private String subject;
    private List<FeedbackMessage> messages;
    private String status; // OPEN, RESOLVED, CLOSED
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime resolvedAt;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FeedbackMessage {
        private String messageId;
        private String senderId;
        private String senderName;
        private String message;
        private LocalDateTime timestamp;
        private List<String> attachmentIds;
    }
}


