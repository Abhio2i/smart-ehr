package com.healthcare.epcr.workflow.service;

import com.healthcare.epcr.security.AccessControlService;
import com.healthcare.epcr.user.repository.UserRepository;
import com.healthcare.epcr.user.model.User;
import com.healthcare.epcr.organization.dto.OrganizationDTO;
import com.healthcare.epcr.organization.repository.OrganizationRepository;
import com.healthcare.epcr.organization.service.OrganizationConfigCacheService;
import com.healthcare.epcr.workflow.model.ConfigDeployment;
import com.healthcare.epcr.workflow.repository.ConfigDeploymentRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ConfigDeploymentService {

    private final ConfigDeploymentRepository configDeploymentRepository;
    private final AccessControlService accessControlService;
    private final OrganizationRepository organizationRepository;
    private final OrganizationConfigCacheService organizationConfigCacheService;
    private final UserRepository userRepository;

    public ConfigDeployment deploy(ConfigDeployment deployment, HttpServletRequest request) {
        User currentUser = accessControlService.currentUser();
        if (!accessControlService.isSystemWideQaUser(currentUser)) {
            throw new IllegalArgumentException("Only Ornge authorized users can deploy configurations.");
        }
        validateDeploymentRequest(deployment);

        LocalDateTime now = LocalDateTime.now();
        String requestId = resolveRequestId(request);
        String ipAddress = resolveClientIp(request);

        deployment.setDeploymentId("dep-" + UUID.randomUUID().toString().replace("-", ""));
        deployment.setSourceOrganizationId(currentUser.getOrganizationId());
        deployment.setSourceOrganizationName(resolveOrganizationName(currentUser.getOrganizationId(), null));
        deployment.setTargetOrganizationNames(resolveOrganizationNames(deployment.getTargetOrganizationIds()));
        deployment.setInitiatedBy(currentUser.getId());
        deployment.setInitiatedByName(buildUserDisplayName(currentUser));
        deployment.setInitiatedByEmail(currentUser.getEmail());
        deployment.setRequestId(requestId);
        deployment.setIpAddress(ipAddress);
        deployment.setFailureReason(null);
        deployment.setApprovedBy(currentUser.getId());
        deployment.setApprovedByName(buildUserDisplayName(currentUser));
        deployment.setApprovedByEmail(currentUser.getEmail());
        deployment.setApprovedAt(now);
        deployment.setStatus("PENDING");
        deployment.setCreatedAt(now);
        deployment.setUpdatedAt(now);
        deployment.setStatusHistory(new ArrayList<>(List.of(
                new ConfigDeployment.StatusEvent("PENDING", now, currentUser.getId(),
                        "Deployment queued", Map.of("requestId", requestId))
        )));

        ConfigDeployment saved = configDeploymentRepository.save(deployment);

        try {
            LocalDateTime appliedAt = LocalDateTime.now();
            saved.setStatus("APPLIED");
            saved.setUpdatedAt(appliedAt);
            saved.setCompletedAt(appliedAt);
            saved.getStatusHistory().add(new ConfigDeployment.StatusEvent(
                    "APPLIED",
                    appliedAt,
                    currentUser.getId(),
                    "Deployment applied successfully",
                    Map.of("ipAddress", ipAddress)
            ));
            return enrichDeploymentForDisplay(configDeploymentRepository.save(saved));
        } catch (RuntimeException ex) {
            LocalDateTime failedAt = LocalDateTime.now();
            saved.setStatus("FAILED");
            saved.setFailureReason(ex.getMessage());
            saved.setUpdatedAt(failedAt);
            saved.setCompletedAt(failedAt);
            saved.getStatusHistory().add(new ConfigDeployment.StatusEvent(
                    "FAILED",
                    failedAt,
                    currentUser.getId(),
                    "Deployment failed",
                    Map.of("error", ex.getMessage() == null ? "unknown" : ex.getMessage())
            ));
            configDeploymentRepository.save(saved);
            throw ex;
        }
    }

    public List<ConfigDeployment> list() {
        User currentUser = accessControlService.currentUser();
        List<ConfigDeployment> deployments;
        if (accessControlService.isSystemWideQaUser(currentUser)) {
            deployments = configDeploymentRepository.findAll();
        } else {
            deployments = configDeploymentRepository.findBySourceOrganizationId(currentUser.getOrganizationId());
        }
        return deployments.stream().map(this::enrichDeploymentForDisplay).toList();
    }

    private void validateDeploymentRequest(ConfigDeployment deployment) {
        if (deployment == null) {
            throw new IllegalArgumentException("Deployment payload is required.");
        }
        if (deployment.getConfigType() == null || deployment.getConfigType().isBlank()) {
            throw new IllegalArgumentException("configType is required.");
        }
        if (deployment.getConfigId() == null || deployment.getConfigId().isBlank()) {
            throw new IllegalArgumentException("configId is required.");
        }
        List<String> targetOrganizationIds = deployment.getTargetOrganizationIds();
        if (targetOrganizationIds == null || targetOrganizationIds.isEmpty()) {
            throw new IllegalArgumentException("At least one target organization is required.");
        }
        for (String orgId : targetOrganizationIds) {
            if (orgId == null || orgId.isBlank() || !organizationRepository.existsById(orgId)) {
                throw new IllegalArgumentException("Target organization not found: " + orgId);
            }
        }
    }

    private String buildUserDisplayName(User user) {
        String first = user.getFirstName() == null ? "" : user.getFirstName().trim();
        String last = user.getLastName() == null ? "" : user.getLastName().trim();
        String full = (first + " " + last).trim();
        return full.isEmpty() ? user.getEmail() : full;
    }

    private String resolveRequestId(HttpServletRequest request) {
        if (request == null) {
            return "req-" + UUID.randomUUID().toString().replace("-", "");
        }
        String requestId = request.getHeader("X-Request-Id");
        if (requestId == null || requestId.isBlank()) {
            requestId = request.getHeader("X-Correlation-Id");
        }
        if (requestId == null || requestId.isBlank()) {
            requestId = "req-" + UUID.randomUUID().toString().replace("-", "");
        }
        return requestId;
    }

    private String resolveClientIp(HttpServletRequest request) {
        if (request == null) {
            return "N/A";
        }
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isBlank()) {
            return xRealIp.trim();
        }
        return request.getRemoteAddr();
    }

    private ConfigDeployment enrichDeploymentForDisplay(ConfigDeployment deployment) {
        if (deployment == null) {
            return null;
        }
        if (deployment.getSourceOrganizationName() == null || deployment.getSourceOrganizationName().isBlank()) {
            deployment.setSourceOrganizationName(resolveOrganizationName(
                    deployment.getSourceOrganizationId(),
                    deployment.getSourceOrganizationId()));
        }
        deployment.setTargetOrganizationNames(resolveOrganizationNames(deployment.getTargetOrganizationIds()));

        if (deployment.getInitiatedByName() == null || deployment.getInitiatedByName().isBlank()
                || deployment.getInitiatedByEmail() == null || deployment.getInitiatedByEmail().isBlank()) {
            userRepository.findById(deployment.getInitiatedBy()).ifPresent(user -> {
                deployment.setInitiatedByName(buildUserDisplayName(user));
                deployment.setInitiatedByEmail(user.getEmail());
            });
        }

        if (deployment.getApprovedBy() != null && !deployment.getApprovedBy().isBlank()
                && (deployment.getApprovedByName() == null || deployment.getApprovedByName().isBlank()
                || deployment.getApprovedByEmail() == null || deployment.getApprovedByEmail().isBlank())) {
            userRepository.findById(deployment.getApprovedBy()).ifPresent(user -> {
                deployment.setApprovedByName(buildUserDisplayName(user));
                deployment.setApprovedByEmail(user.getEmail());
            });
        }

        if (deployment.getInitiatedByName() == null || deployment.getInitiatedByName().isBlank()) {
            deployment.setInitiatedByName(deployment.getInitiatedBy());
        }
        if (deployment.getApprovedByName() == null || deployment.getApprovedByName().isBlank()) {
            deployment.setApprovedByName(deployment.getApprovedBy());
        }
        return deployment;
    }

    private List<String> resolveOrganizationNames(List<String> targetOrganizationIds) {
        if (targetOrganizationIds == null) {
            return List.of();
        }
        return targetOrganizationIds.stream()
                .map(orgId -> resolveOrganizationName(orgId, orgId))
                .toList();
    }

    private String resolveOrganizationName(String organizationId, String fallback) {
        OrganizationDTO organization = organizationConfigCacheService.getOrganization(organizationId);
        if (organization == null || organization.getName() == null || organization.getName().isBlank()) {
            return fallback;
        }
        return organization.getName();
    }
}
