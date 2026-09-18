package com.healthcare.epcr.reports.controller;

import com.healthcare.epcr.auth.dto.CurrentUserResponse;
import com.healthcare.epcr.auth.service.AuthService;
import com.healthcare.epcr.reports.dto.PatientRegistrationStatsDTO;
import com.healthcare.epcr.reports.service.PatientAnalyticsService;
import com.healthcare.epcr.user.model.Role;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/reports/patients")
@RequiredArgsConstructor
public class PatientAnalyticsController {

    private final PatientAnalyticsService patientAnalyticsService;
    private final AuthService authService;

    @GetMapping("/summary")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN','PARAMEDIC','QA_REVIEWER')")
    public ResponseEntity<PatientRegistrationStatsDTO> summary(
            @RequestParam(required = false) String organizationId,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false, defaultValue = "false") boolean refresh) {

        CurrentUserResponse currentUser = authService.getCurrentUser();
        boolean isAdmin = currentUser != null && (currentUser.getRole() == Role.ADMIN || currentUser.getRole() == Role.MANAGER);

        String scopedOrgId = isAdmin
                ? organizationId
                : (currentUser != null ? currentUser.getOrganizationId() : null);

        if (refresh) {
            patientAnalyticsService.clearCache(scopedOrgId);
        }

        PatientRegistrationStatsDTO dto = patientAnalyticsService.getSummary(scopedOrgId, startDate, endDate, isAdmin);
        return ResponseEntity.ok(dto);
    }

    @GetMapping("/count")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN','PARAMEDIC','QA_REVIEWER')")
    public ResponseEntity<Long> fastCount(
            @RequestParam(required = false) String organizationId) {

        CurrentUserResponse currentUser = authService.getCurrentUser();
        boolean isAdmin = currentUser != null && (currentUser.getRole() == Role.ADMIN || currentUser.getRole() == Role.MANAGER);

        String scopedOrgId = isAdmin
                ? organizationId
                : (currentUser != null ? currentUser.getOrganizationId() : null);

        long count = patientAnalyticsService.getFastCount(scopedOrgId);
        return ResponseEntity.ok(count);
    }

    @GetMapping("/search")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','PHYSICIAN','PARAMEDIC','QA_REVIEWER')")
    public ResponseEntity<PatientRegistrationStatsDTO> search(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false) String organizationId) {

        CurrentUserResponse currentUser = authService.getCurrentUser();
        boolean isAdmin = currentUser != null && (currentUser.getRole() == Role.ADMIN || currentUser.getRole() == Role.MANAGER);

        String scopedOrgId = isAdmin
                ? organizationId
                : (currentUser != null ? currentUser.getOrganizationId() : null);

        PatientRegistrationStatsDTO dto = patientAnalyticsService.searchSummary(scopedOrgId, query, startDate, endDate, isAdmin);
        return ResponseEntity.ok(dto);
    }
}
