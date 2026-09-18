package com.healthcare.epcr.qa.model;

import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.annotation.Id;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "qa_reviews")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class QAReview {
    @Id
    private String id;
    private String patientCareRecordId;
    private String qaFormId;
    private String reviewerId;
    private List<QAResponse> responses;
    private Double score;
    private Boolean passed;
    private String feedback;
    private String status; // PENDING, COMPLETED, APPROVED, REJECTED
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime completedAt;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QAResponse {
        private String questionId;
        private String answer;
    }
}


