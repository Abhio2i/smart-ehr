package com.healthcare.epcr.auditlog.service;

import com.healthcare.epcr.auditlog.model.AuditLog;
import com.healthcare.epcr.auditlog.repository.AuditLogRepository;
import com.healthcare.epcr.security.AccessControlService;
import com.healthcare.epcr.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.util.StringUtils;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.scheduling.annotation.Async;

@Service
@RequiredArgsConstructor
public class AuditLogService {
    private final AuditLogRepository auditLogRepository;
    private final AccessControlService accessControlService;
    private final UserRepository userRepository;

    public AuditLog logAction(String userId, String action, String entityType, String entityId, String details) {
        AuditLog log = new AuditLog();
        log.setUserId(userId);
        log.setAction(action);
        log.setEntityType(entityType);
        log.setEntityId(entityId);
        log.setDetails(details);
        log.setTimestamp(LocalDateTime.now());
        log.setStatus("SUCCESS");
        return auditLogRepository.save(log);
    }

    public AuditLog logActionWithStatus(String userId, String action, String entityType, String entityId,
                                        String details, String status, String ipAddress) {
        AuditLog log = new AuditLog();
        log.setUserId(userId);
        log.setAction(action);
        log.setEntityType(entityType);
        log.setEntityId(entityId);
        log.setDetails(details);
        log.setTimestamp(LocalDateTime.now());
        log.setStatus(StringUtils.hasText(status) ? status : "SUCCESS");
        log.setIpAddress(ipAddress);
        log.setChangesMade(details);
        return auditLogRepository.save(log);
    }

    public AuditLog logActionWithChanges(String userId, String userDisplayName, String action, String entityType, String entityId,
                                         List<AuditLog.FieldChange> changes, String details, String status, String ipAddress) {
        AuditLog log = AuditLog.builder()
                .userId(userId)
                .userDisplayName(userDisplayName)
                .action(action)
                .entityType(entityType)
                .entityId(entityId)
                .fieldChanges(changes)
                .details(details)
                .timestamp(LocalDateTime.now())
                .status(StringUtils.hasText(status) ? status : "SUCCESS")
                .ipAddress(ipAddress)
                .build();
        return auditLogRepository.save(log);
    }

    public List<AuditLog> getLogsByUser(String userId) {
        return auditLogRepository.findByUserId(userId).stream()
                .filter(this::canAccessAuditLog)
                .toList();
    }

    public List<AuditLog> getLogsByAction(String action) {
        return auditLogRepository.findByAction(action).stream()
                .filter(this::canAccessAuditLog)
                .toList();
    }

    public List<AuditLog> getLogsByEntity(String entityType, String entityId) {
        return auditLogRepository.findByEntityTypeAndEntityId(entityType, entityId).stream()
                .filter(this::canAccessAuditLog)
                .toList();
    }


    public List<AuditLog> getAllLogs() {
        return auditLogRepository.findAll(Sort.by(Sort.Direction.DESC, "timestamp")).stream()
                .filter(this::canAccessAuditLog)
                .toList();
    }

    public com.healthcare.epcr.common.dto.PageResponse<AuditLog> getAllLogsPaginated(int page, int size) {
        var pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "timestamp"));
        var logsPage = auditLogRepository.findAllBy(pageable);
        var filtered = logsPage.getContent().stream()
                .filter(this::canAccessAuditLog)
                .toList();
        return new com.healthcare.epcr.common.dto.PageResponse<>(
                filtered,
                page,
                size,
                logsPage.getTotalElements(),
                logsPage.getTotalPages(),
                logsPage.isLast()
        );
    }

    public List<AuditLog> saveAllLogs(List<AuditLog> logs) {
        if (logs == null || logs.isEmpty()) {
            return List.of();
        }
        for (AuditLog log : logs) {
            if (log.getTimestamp() == null) {
                log.setTimestamp(LocalDateTime.now());
            }
            if (log.getStatus() == null) {
                log.setStatus("SUCCESS");
            }
        }
        return auditLogRepository.saveAll(logs);
    }

    @Async
    public void saveAllLogsAsync(List<AuditLog> logs) {
        saveAllLogs(logs);
    }

    private boolean canAccessAuditLog(AuditLog log) {
        if (log == null || log.getUserId() == null || log.getUserId().isBlank()
                || "SYSTEM".equals(log.getUserId())
                || "anonymousUser".equals(log.getUserId())
                || "unknown".equals(log.getUserId())) {
            return true;
        }
        return userRepository.findById(log.getUserId())
                .map(user -> accessControlService.canAccessOrganization(user.getOrganizationId()))
                .orElse(false);
    }
}
