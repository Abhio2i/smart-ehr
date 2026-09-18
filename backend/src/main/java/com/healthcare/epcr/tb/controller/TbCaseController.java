package com.healthcare.epcr.tb.controller;

import com.healthcare.epcr.common.dto.PageResponse;
import com.healthcare.epcr.security.AccessControlService;
import com.healthcare.epcr.tb.dto.*;
import com.healthcare.epcr.tb.enums.ContactInvestigationStatus;
import com.healthcare.epcr.tb.enums.TbCaseStatus;
import com.healthcare.epcr.tb.model.TbCase;
import com.healthcare.epcr.tb.model.TbContact;
import com.healthcare.epcr.tb.model.TbTstTest;
import com.healthcare.epcr.tb.service.TbCaseService;
import com.healthcare.epcr.tb.model.TbDotLog;
import com.healthcare.epcr.tb.enums.DotStatus;
import com.healthcare.epcr.user.model.User;
import java.time.LocalDate;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tb")
@RequiredArgsConstructor
public class TbCaseController {

    private final TbCaseService tbCaseService;
    private final com.healthcare.epcr.tb.service.BulkContactImportService bulkContactImportService;
    private final AccessControlService accessControlService;

    // ── Stats ────────────────────────────────────────────────────────────────

    @GetMapping("/stats")
    @PreAuthorize("hasAnyRole('ADMIN','PHYSICIAN','PARAMEDIC','MANAGER')")
    public ResponseEntity<TbStatsDTO> getStats() {
        User user = accessControlService.currentUser();
        return ResponseEntity.ok(tbCaseService.getStats(user.getOrganizationId()));
    }

    // ── Cases ────────────────────────────────────────────────────────────────

    @PostMapping("/cases")
    @PreAuthorize("hasAnyRole('ADMIN','PHYSICIAN')")
    public ResponseEntity<TbCase> createCase(@Valid @RequestBody CreateTbCaseRequest req) {
        User user = accessControlService.currentUser();
        TbCase created = tbCaseService.createCase(req, user.getOrganizationId(), user.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping("/cases")
    @PreAuthorize("hasAnyRole('ADMIN','PHYSICIAN','PARAMEDIC','MANAGER')")
    public ResponseEntity<PageResponse<TbCase>> listCases(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) TbCaseStatus status) {
        User user = accessControlService.currentUser();
        Page<TbCase> result = tbCaseService.listCases(user.getOrganizationId(), status, page, size);
        return ResponseEntity.ok(PageResponse.from(result));
    }

    @GetMapping("/cases/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','PHYSICIAN','PARAMEDIC','MANAGER')")
    public ResponseEntity<TbCase> getCaseById(@PathVariable String id) {
        User user = accessControlService.currentUser();
        return ResponseEntity.ok(tbCaseService.getCaseById(id, user.getOrganizationId()));
    }

    @PutMapping("/cases/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN','PHYSICIAN')")
    public ResponseEntity<TbCase> updateStatus(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        User user = accessControlService.currentUser();
        TbCaseStatus newStatus = TbCaseStatus.valueOf(body.get("status"));
        return ResponseEntity.ok(tbCaseService.updateCaseStatus(id, newStatus, user.getOrganizationId()));
    }

    // ── Contacts ─────────────────────────────────────────────────────────────

    @PostMapping("/cases/{caseId}/contacts")
    @PreAuthorize("hasAnyRole('ADMIN','PHYSICIAN')")
    public ResponseEntity<TbContact> linkContact(
            @PathVariable String caseId,
            @Valid @RequestBody LinkContactRequest req) {
        User user = accessControlService.currentUser();
        TbContact contact = tbCaseService.linkContact(caseId, req, user.getOrganizationId(), user.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(contact);
    }

    @PostMapping(value = "/cases/{caseId}/contacts/bulk-import", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN','PHYSICIAN')")
    public ResponseEntity<com.healthcare.epcr.tb.dto.BulkContactImportResultDTO> bulkImportContacts(
            @PathVariable String caseId,
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        User user = accessControlService.currentUser();
        com.healthcare.epcr.tb.dto.BulkContactImportResultDTO result =
                bulkContactImportService.importContactsFromCsv(caseId, file, user.getOrganizationId(), user.getId());
        return ResponseEntity.ok(result);
    }

    @GetMapping("/cases/{caseId}/contacts")
    @PreAuthorize("hasAnyRole('ADMIN','PHYSICIAN','PARAMEDIC','MANAGER')")
    public ResponseEntity<List<TbContact>> getContacts(@PathVariable String caseId) {
        User user = accessControlService.currentUser();
        return ResponseEntity.ok(tbCaseService.getContactsForCase(caseId, user.getOrganizationId()));
    }

    @PutMapping("/contacts/{contactId}/status")
    @PreAuthorize("hasAnyRole('ADMIN','PHYSICIAN')")
    public ResponseEntity<TbContact> updateContactStatus(
            @PathVariable String contactId,
            @RequestBody Map<String, String> body) {
        User user = accessControlService.currentUser();
        ContactInvestigationStatus status = ContactInvestigationStatus.valueOf(body.get("status"));
        return ResponseEntity.ok(tbCaseService.updateContactStatus(contactId, status, user.getOrganizationId()));
    }

    // ── TST Tests ─────────────────────────────────────────────────────────────

    @PostMapping("/contacts/{contactId}/tst")
    @PreAuthorize("hasAnyRole('ADMIN','PHYSICIAN')")
    public ResponseEntity<TbTstTest> addTstTest(
            @PathVariable String contactId,
            @RequestBody AddTstTestRequest req) {
        User user = accessControlService.currentUser();
        TbTstTest test = tbCaseService.addTstTest(contactId, req, user.getOrganizationId(), user.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(test);
    }

    @GetMapping("/contacts/{contactId}/tst")
    @PreAuthorize("hasAnyRole('ADMIN','PHYSICIAN','PARAMEDIC','MANAGER')")
    public ResponseEntity<List<TbTstTest>> getTstTests(@PathVariable String contactId) {
        User user = accessControlService.currentUser();
        return ResponseEntity.ok(tbCaseService.getTstTestsForContact(contactId, user.getOrganizationId()));
    }

    // ── DOT Logs ─────────────────────────────────────────────────────────────

    @PostMapping("/cases/{id}/dot")
    @PreAuthorize("hasAnyRole('ADMIN','PHYSICIAN')")
    public ResponseEntity<TbDotLog> recordDotLog(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        User user = accessControlService.currentUser();
        LocalDate logDate = LocalDate.parse(body.get("logDate"));
        DotStatus status = DotStatus.valueOf(body.get("status"));
        String notes = body.get("notes");
        TbDotLog log = tbCaseService.saveDotLog(id, logDate, status, notes, user.getOrganizationId(), user.getId(), user.getFirstName() + " " + user.getLastName());
        return ResponseEntity.ok(log);
    }

    @GetMapping("/cases/{id}/dot")
    @PreAuthorize("hasAnyRole('ADMIN','PHYSICIAN','PARAMEDIC','MANAGER')")
    public ResponseEntity<List<TbDotLog>> getDotLogs(
            @PathVariable String id,
            @RequestParam(required = false) String start,
            @RequestParam(required = false) String end) {
        User user = accessControlService.currentUser();
        LocalDate startDate = start != null ? LocalDate.parse(start) : null;
        LocalDate endDate = end != null ? LocalDate.parse(end) : null;
        List<TbDotLog> logs = tbCaseService.getDotLogs(id, startDate, endDate, user.getOrganizationId());
        return ResponseEntity.ok(logs);
    }

    // ── Sputum Clearance ─────────────────────────────────────────────────────

    @PutMapping("/cases/{id}/sputum")
    @PreAuthorize("hasAnyRole('ADMIN','PHYSICIAN')")
    public ResponseEntity<TbCase> updateSputumResult(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        User user = accessControlService.currentUser();
        String sampleIndex = body.get("sampleIndex");
        String result = body.get("result");
        LocalDate dateCollected = body.get("dateCollected") != null ? LocalDate.parse(body.get("dateCollected")) : LocalDate.now();
        TbCase updated = tbCaseService.updateSputumChecklist(id, sampleIndex, result, dateCollected, user.getOrganizationId());
        return ResponseEntity.ok(updated);
    }
}
