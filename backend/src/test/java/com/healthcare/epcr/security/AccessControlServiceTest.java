package com.healthcare.epcr.security;

import com.healthcare.epcr.organization.dto.OrganizationDTO;
import com.healthcare.epcr.organization.service.OrganizationConfigCacheService;
import com.healthcare.epcr.user.model.Role;
import com.healthcare.epcr.user.model.User;
import com.healthcare.epcr.user.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class AccessControlServiceTest {

    @AfterEach
    void cleanup() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void providerCanOnlyAccessOwnOrganization() {
        UserRepository userRepo = Mockito.mock(UserRepository.class);
        OrganizationConfigCacheService organizationConfigCacheService = Mockito.mock(OrganizationConfigCacheService.class);
        AccessControlService service = new AccessControlService(userRepo, organizationConfigCacheService);

        User provider = new User();
        provider.setEmail("provider@demo.local");
        provider.setOrganizationId("org-provider");
        provider.setRole(Role.QA_REVIEWER);
        Mockito.when(userRepo.findByEmail("provider@demo.local")).thenReturn(Optional.of(provider));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("provider@demo.local", "n/a"));

        assertTrue(service.canAccessOrganization("org-provider"));
        assertFalse(service.canAccessOrganization("org-other"));
    }

    @Test
    void orngeAdminHasSystemWideAccess() {
        UserRepository userRepo = Mockito.mock(UserRepository.class);
        OrganizationConfigCacheService organizationConfigCacheService = Mockito.mock(OrganizationConfigCacheService.class);
        AccessControlService service = new AccessControlService(userRepo, organizationConfigCacheService);

        User orngeAdmin = new User();
        orngeAdmin.setEmail("ornge@demo.local");
        orngeAdmin.setOrganizationId("org-ornge");
        orngeAdmin.setRole(Role.ADMIN);
        Mockito.when(userRepo.findByEmail("ornge@demo.local")).thenReturn(Optional.of(orngeAdmin));

        OrganizationDTO ornge = new OrganizationDTO();
        ornge.setId("org-ornge");
        ornge.setOrngeAuthority(true);
        Mockito.when(organizationConfigCacheService.getOrganization("org-ornge")).thenReturn(ornge);

        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("ornge@demo.local", "n/a"));
        assertTrue(service.canAccessOrganization("org-provider"));
    }
}
