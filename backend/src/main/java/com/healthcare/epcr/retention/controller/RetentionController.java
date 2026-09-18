package com.healthcare.epcr.retention.controller;

import com.healthcare.epcr.retention.enums.DispositionStatus;
import com.healthcare.epcr.retention.model.DispositionReview;
import com.healthcare.epcr.retention.model.RetentionFolder;
import com.healthcare.epcr.retention.model.RetentionRule;
import com.healthcare.epcr.retention.service.BulkMetadataImportService;
import com.healthcare.epcr.retention.service.RetentionService;
import com.healthcare.epcr.security.AccessControlService;
import com.healthcare.epcr.user.model.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/retention")
@RequiredArgsConstructor
public class RetentionController {

    private final RetentionService retentionService;
    private final BulkMetadataImportService bulkMetadataImportService;
    private final AccessControlService accessControlService;

    // ── 1. Rules ─────────────────────────────────────────────────────────────

    @PostMapping("/rules")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<RetentionRule> createRule(@RequestBody RetentionRule rule) {
        User user = accessControlService.currentUser();
        String createdByName = user.getFirstName() + " " + user.getLastName();
        RetentionRule created = retentionService.createRule(rule, user.getOrganizationId(), user.getId(), createdByName);
        return ResponseEntity.ok(created);
    }

    @PostMapping(value = "/rules/bulk-import", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<com.healthcare.epcr.retention.dto.BulkMetadataImportResult> bulkImportMetadata(
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        User user = accessControlService.currentUser();
        String userName = user.getFirstName() + " " + user.getLastName();
        com.healthcare.epcr.retention.dto.BulkMetadataImportResult result =
                bulkMetadataImportService.importMetadataFile(file, user.getOrganizationId(), user.getId(), userName);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/rules")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<List<RetentionRule>> getRules() {
        User user = accessControlService.currentUser();
        return ResponseEntity.ok(retentionService.getRules(user.getOrganizationId()));
    }

    // ── 2. Folders ───────────────────────────────────────────────────────────

    @PostMapping("/folders")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<RetentionFolder> createFolder(@RequestBody RetentionFolder folder) {
        User user = accessControlService.currentUser();
        String createdByName = user.getFirstName() + " " + user.getLastName();
        RetentionFolder created = retentionService.createFolder(folder, user.getOrganizationId(), user.getId(), createdByName);
        return ResponseEntity.ok(created);
    }

    @GetMapping("/folders")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<List<RetentionFolder>> getFolders() {
        User user = accessControlService.currentUser();
        return ResponseEntity.ok(retentionService.getFolders(user.getOrganizationId()));
    }

    // ── 3. Disposition Reviews ───────────────────────────────────────────────

    @GetMapping("/dispositions")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<List<DispositionReview>> getPendingReviews() {
        User user = accessControlService.currentUser();
        return ResponseEntity.ok(retentionService.getPendingReviews(user.getOrganizationId()));
    }

    @PostMapping("/dispositions/{id}/action")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<DispositionReview> actionDisposition(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        User user = accessControlService.currentUser();
        DispositionStatus status = DispositionStatus.valueOf(body.get("status"));
        String notes = body.get("notes");
        DispositionReview review = retentionService.actionDisposition(
                id,
                status,
                notes,
                user.getId(),
                user.getFirstName() + " " + user.getLastName(),
                user.getOrganizationId()
        );
        return ResponseEntity.ok(review);
    }

    // ── 4. Legal / Audit Hold ────────────────────────────────────────────────

    @PutMapping("/records/{recordType}/{recordId}/hold")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<Void> setRecordHold(
            @PathVariable String recordType,
            @PathVariable String recordId,
            @RequestBody Map<String, Object> body) {
        User user = accessControlService.currentUser();
        boolean hold = (Boolean) body.get("hold");
        String reason = (String) body.get("reason");
        retentionService.setRecordHold(recordType, recordId, hold, reason, user.getOrganizationId(), user.getId());
        return ResponseEntity.ok().build();
    }
}
