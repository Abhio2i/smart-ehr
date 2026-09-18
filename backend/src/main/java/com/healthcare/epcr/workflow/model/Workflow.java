package com.healthcare.epcr.workflow.model;

import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.annotation.Id;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Document(collection = "workflows")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Workflow {
    @Id
    private String id;
    private String name;
    private String description;
    private String organizationId;
    private String domain; // EPCR, QA_QI
    private String category; // incident, safety, clinical_services, medications, collision
    private String reviewCategory; // ventilation, cardiac, trauma
    private Map<String, Object> formSchema;
    private List<RuleCondition> rules;
    private List<WorkflowStep> steps;
    private Boolean active;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WorkflowStep {
        private Integer stepNumber;
        private String stepName;
        private String assignedRole;
        private String action;
        private Integer durationDays;
        private Boolean isMandatory;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RuleCondition {
        private String id;
        private String ifExpression;
        private String thenAction;
        private Map<String, Object> parameters;
        private Boolean active;
    }
}


