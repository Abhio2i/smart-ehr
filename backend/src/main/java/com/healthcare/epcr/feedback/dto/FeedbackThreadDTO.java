package com.healthcare.epcr.feedback.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class FeedbackThreadDTO {
    private String id;
    private String patientCareRecordId;
    private String initiatedBy;
    private String subject;
    private List<FeedbackMessageDTO> messages;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime resolvedAt;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FeedbackMessageDTO {
        private String messageId;
        private String senderId;
        private String senderName;
        private String message;
        private LocalDateTime timestamp;
        private List<String> attachmentIds;
    }
}


