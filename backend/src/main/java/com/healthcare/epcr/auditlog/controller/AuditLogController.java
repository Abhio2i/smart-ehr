package com.healthcare.epcr.auditlog.controller;

import com.healthcare.epcr.auditlog.model.AuditLog;
import com.healthcare.epcr.auditlog.service.AuditLogService;
import com.healthcare.epcr.common.dto.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.http.HttpStatus;

@RestController
@RequestMapping("/api/audit")
@RequiredArgsConstructor
public class AuditLogController {

    private final AuditLogService auditLogService;

    @GetMapping("/logs")
    public ResponseEntity<?> getAuditLogs(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        if (page != null || size != null) {
            int resolvedPage = page == null ? 0 : Math.max(page, 0);
            int resolvedSize = size == null ? 20 : Math.min(Math.max(size, 1), 200);
            PageResponse<AuditLog> paged = auditLogService.getAllLogsPaginated(resolvedPage, resolvedSize);
            return ResponseEntity.ok(paged);
        }
        List<AuditLog> logs = auditLogService.getAllLogs();
        return ResponseEntity.ok(logs);
    }

    @GetMapping("/logs/entity/{entityType}/{entityId}")
    public ResponseEntity<List<AuditLog>> getLogsByEntity(
            @PathVariable String entityType,
            @PathVariable String entityId) {
        return ResponseEntity.ok(auditLogService.getLogsByEntity(entityType, entityId));
    }

    @GetMapping("/logs/user/{userId}")
    public ResponseEntity<List<AuditLog>> getLogsByUser(@PathVariable String userId) {
        return ResponseEntity.ok(auditLogService.getLogsByUser(userId));
    }

    @GetMapping("/logs/action/{action}")
    public ResponseEntity<List<AuditLog>> getLogsByAction(@PathVariable String action) {
        return ResponseEntity.ok(auditLogService.getLogsByAction(action));
    }

    @PostMapping("/logs/bulk")
    public ResponseEntity<String> createAuditLogs(@RequestBody List<AuditLog> logs) {
        auditLogService.saveAllLogsAsync(logs);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body("Bulk audit logs queued for sync.");
    }
}
