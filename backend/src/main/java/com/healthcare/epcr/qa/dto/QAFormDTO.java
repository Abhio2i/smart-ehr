package com.healthcare.epcr.qa.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class QAFormDTO {
    private String id;
    private String name;
    private String description;
    private Integer version;
    private String organizationId;
    private List<QAQuestionDTO> questions;
    private Boolean active;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QAQuestionDTO {
        private String id;
        private String question;
        private String type;
        private Boolean required;
        private List<String> options;
    }
}


