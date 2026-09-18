package com.healthcare.epcr.qa.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class QAReviewDTO {
    private String id;
    private String recordId;
    private String recordDisplay;
    private String qaFormId;
    private String reviewerId;
    private String reviewerName;
    private String reviewerEmail;
    private List<QAResponseDTO> responses;
    private Double score;
    private String scoreDisplay;
    private Boolean passed;
    private String feedback;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime completedAt;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QAResponseDTO {
        private String questionId;
        private String answer;
    }
}


