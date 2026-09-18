package com.healthcare.epcr.sharing.controller;

import com.healthcare.epcr.auth.dto.CurrentUserResponse;
import com.healthcare.epcr.auth.service.AuthService;
import com.healthcare.epcr.sharing.dto.CreateShareRequest;
import com.healthcare.epcr.sharing.dto.ShareResponse;
import com.healthcare.epcr.sharing.service.RecordShareService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Internal (authenticated) endpoints. External/tokenized endpoints live in
 * ExternalShareController since they must NOT sit behind the standard JWT
 * session filter — they authenticate via the one-time token instead.
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class RecordShareController {

    private final RecordShareService recordShareService;
    private final AuthService authService;

    @PostMapping("/records/{recordId}/shares")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHYSICIAN')")
    public ResponseEntity<ShareResponse> createShare(
            @PathVariable String recordId,
            @Valid @RequestBody CreateShareRequest request) {

        CurrentUserResponse user = authService.getCurrentUser();
        String organizationId = user.getOrganizationId();
        String userId = user.getId();
        String userName = (user.getFirstName() != null ? user.getFirstName() : "") +
                (user.getLastName() != null ? " " + user.getLastName() : "");

        ShareResponse response = recordShareService.createShare(request, recordId, organizationId, userId, userName.trim());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/records/{recordId}/shares")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER')")
    public ResponseEntity<List<ShareResponse>> getSharesForRecord(
            @PathVariable String recordId) {

        CurrentUserResponse user = authService.getCurrentUser();
        return ResponseEntity.ok(recordShareService.getSharesForRecord(recordId, user.getOrganizationId()));
    }

    @GetMapping("/shares/inbox")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER')")
    public ResponseEntity<Page<ShareResponse>> getInbox(
            Pageable pageable) {

        CurrentUserResponse user = authService.getCurrentUser();
        String roleStr = user.getRole() != null ? user.getRole().name() : "";
        return ResponseEntity.ok(recordShareService.getInbox(user.getId(), roleStr, user.getOrganizationId(), pageable));
    }

    @GetMapping("/shares/{shareId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHYSICIAN', 'PARAMEDIC')")
    public ResponseEntity<ShareResponse> viewShare(
            @PathVariable String shareId) {

        CurrentUserResponse user = authService.getCurrentUser();
        return ResponseEntity.ok(recordShareService.viewInternalShare(shareId, user.getOrganizationId(), user.getId()));
    }

    @PostMapping("/shares/{shareId}/revoke")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHYSICIAN', 'PARAMEDIC')")
    public ResponseEntity<ShareResponse> revokeShare(
            @PathVariable String shareId) {

        CurrentUserResponse user = authService.getCurrentUser();
        return ResponseEntity.ok(recordShareService.revokeShare(shareId, user.getOrganizationId(), user.getId()));
    }

    @PostMapping("/shares/{shareId}/response")
    @PreAuthorize("hasAnyRole('ADMIN', 'PHYSICIAN', 'PARAMEDIC')")
    public ResponseEntity<ShareResponse> respondToShare(
            @PathVariable String shareId,
            @RequestBody Map<String, String> body) {

        CurrentUserResponse user = authService.getCurrentUser();
        return ResponseEntity.ok(recordShareService.addResponse(shareId, user.getOrganizationId(), user.getId(), body.get("responseNotes")));
    }
}
