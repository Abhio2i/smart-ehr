package com.healthcare.epcr.workflow.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class WorkflowDTO {
    private String id;
    private String name;
    private String description;
    private String organizationId;
    private List<WorkflowStepDTO> steps;
    private Boolean active;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WorkflowStepDTO {
        private Integer stepNumber;
        private String stepName;
        private String assignedRole;
        private String action;
        private Integer durationDays;
        private Boolean isMandatory;
    }
}


