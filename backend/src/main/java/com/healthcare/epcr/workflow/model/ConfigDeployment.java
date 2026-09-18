package com.healthcare.epcr.workflow.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Document(collection = "config_deployments")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ConfigDeployment {
    @Id
    private String id;
    private String deploymentId;
    private String sourceOrganizationId;
    private String sourceOrganizationName;
    private List<String> targetOrganizationIds;
    private String configType; // WORKFLOW, QA_FORM
    private String configId;
    private Integer configVersion;
    private String status; // PENDING, APPLIED, FAILED
    private String initiatedBy;
    private String initiatedByName;
    private String initiatedByEmail;
    private String approvedBy;
    private String approvedByName;
    private String approvedByEmail;
    private LocalDateTime approvedAt;
    private String failureReason;
    private String requestId;
    private String ipAddress;
    private List<String> targetOrganizationNames;
    private List<StatusEvent> statusHistory;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime completedAt;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StatusEvent {
        private String status;
        private LocalDateTime timestamp;
        private String actorId;
        private String note;
        private Map<String, Object> metadata;
    }
}
