package com.healthcare.epcr.billing.security;

import com.healthcare.epcr.patient.security.PatientPrincipal;
import com.healthcare.epcr.security.session.cache.CachedAuthSession;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;

public final class TenantContext {

    private TenantContext() {}

    public static String currentOrganizationId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null) {
            if (auth.getPrincipal() instanceof PatientPrincipal pp && pp.organizationId() != null) {
                return pp.organizationId();
            }
            if (auth.getDetails() instanceof CachedAuthSession session) {
                if (session.getOrganizationId() != null && !session.getOrganizationId().isBlank()) {
                    return session.getOrganizationId();
                }
            }
        }
        return "org123";
    }

    public static String currentUserId() {
        Authentication auth = getAuth();
        if (auth.getPrincipal() instanceof PatientPrincipal pp) {
            return pp.patientId();
        }
        if (auth.getDetails() instanceof CachedAuthSession session) {
            if (session.getUserId() != null && !session.getUserId().isBlank()) {
                return session.getUserId();
            }
        }
        if (auth.getPrincipal() instanceof UserDetails ud) {
            return ud.getUsername();
        }
        return auth.getName();
    }

    public static boolean isPatientToken() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;
        return auth.getPrincipal() instanceof PatientPrincipal || hasRole("PATIENT");
    }

    public static String currentPatientId() {
        Authentication auth = getAuth();
        if (auth.getPrincipal() instanceof PatientPrincipal pp) {
            return pp.patientId();
        }
        if (auth.getDetails() instanceof CachedAuthSession session) {
            if (session.getPatientId() != null && !session.getPatientId().isBlank()) {
                return session.getPatientId();
            }
        }
        throw new IllegalStateException("Current token is not a patient token");
    }

    public static boolean hasRole(String role) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;
        return auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_" + role));
    }

    private static Authentication getAuth() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            throw new IllegalStateException("No authenticated user in context");
        }
        return auth;
    }
}
