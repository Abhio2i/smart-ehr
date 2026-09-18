package com.healthcare.epcr.qa.model;

import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.annotation.Id;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Document(collection = "qa_forms")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class QAForm {
    @Id
    private String id;
    private String name;
    private String description;
    private Integer version;
    private String organizationId;
    private String reviewCategory;
    private List<String> callTypes;
    private List<QAQuestion> questions;
    private List<AuditCriterion> auditCriteria;
    private List<RuleDefinition> routingRules;
    private Boolean active;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QAQuestion {
        private String id;
        private String question;
        private String type; // text, checkbox, radio, etc.
        private Boolean required;
        private List<String> options;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AuditCriterion {
        private String id;
        private String name;
        private String description;
        private Double weight;
        private Boolean mandatory;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RuleDefinition {
        private String id;
        private String ruleName;
        private String conditionExpression;
        private String action;
        private Map<String, Object> actionParameters;
        private Boolean active;
    }
}


