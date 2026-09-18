package com.healthcare.epcr.security;

import com.healthcare.epcr.common.exception.ResourceNotFoundException;
import com.healthcare.epcr.organization.dto.OrganizationDTO;
import com.healthcare.epcr.organization.service.OrganizationConfigCacheService;
import com.healthcare.epcr.security.session.cache.CachedAuthSession;
import com.healthcare.epcr.user.model.Role;
import com.healthcare.epcr.user.model.User;
import com.healthcare.epcr.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import com.healthcare.epcr.patient.security.PatientPrincipal;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AccessControlService {

    private final UserRepository userRepository;
    private final OrganizationConfigCacheService organizationConfigCacheService;

    public User currentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null) {
            throw new IllegalArgumentException("Authenticated user not found");
        }

        // Handle Patient Portal users (Patients)
        if (authentication.getPrincipal() instanceof PatientPrincipal pp) {
            User patientUser = new User();
            patientUser.setId(pp.patientId());
            patientUser.setEmail(pp.subject());
            patientUser.setOrganizationId(pp.organizationId());
            patientUser.setRole(Role.PATIENT);
            return patientUser;
        }

        Object details = authentication.getDetails();
        if (details instanceof CachedAuthSession session
                && session.getUserId() != null
                && !session.getUserId().isBlank()) {
            User userById = userRepository.findById(session.getUserId()).orElse(null);
            String authName = authentication.getName();
            boolean emailMatches = authName == null
                    || authName.isBlank()
                    || (userById != null && userById.getEmail() != null
                    && userById.getEmail().equalsIgnoreCase(authName));
            if (userById != null && emailMatches) {
                return userById;
            }
        }

        if (authentication.getName() == null) {
            throw new IllegalArgumentException("Authenticated user not found");
        }

        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResourceNotFoundException("Authenticated user not found with email: " + authentication.getName()));
    }

    public boolean canAccessOrganization(String organizationId) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof PatientPrincipal) {
            PatientPrincipal pp = (PatientPrincipal) authentication.getPrincipal();
            return organizationId != null && organizationId.equals(pp.organizationId());
        }
        User user = currentUser();
        if (user.getRole() == Role.ADMIN) {
            return true;
        }
        if (user.getOrganizationId() == null || user.getOrganizationId().isBlank()) {
            return true;
        }
        if (organizationId == null || organizationId.isBlank() || "org-default".equalsIgnoreCase(organizationId)) {
            return true;
        }
        return organizationId.equals(user.getOrganizationId());
    }

    public void assertOrganizationAccess(String organizationId) {
        if (!canAccessOrganization(organizationId)) {
            throw new IllegalArgumentException("Access denied for organizationId: " + organizationId);
        }
    }

    public boolean isSystemWideQaUser(User user) {
        if (user == null) {
            return false;
        }
        if (user.getRole() == Role.QA_REVIEWER
                || user.getRole() == Role.PHYSICIAN) {
            return isOrngeAuthorityOrg(organizationConfigCacheService.getOrganization(user.getOrganizationId()));
        }
        return false;
    }

    private boolean isOrngeAuthorityOrg(OrganizationDTO org) {
        return org != null && Boolean.TRUE.equals(org.getOrngeAuthority());
    }
}
