package com.healthcare.epcr.organization.service.impl;

import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import com.healthcare.epcr.security.AccessControlService;
import com.healthcare.epcr.organization.model.Organization;
import com.healthcare.epcr.organization.repository.OrganizationRepository;
import com.healthcare.epcr.organization.dto.OrganizationDTO;
import com.healthcare.epcr.organization.dto.CreateOrganizationRequest;
import com.healthcare.epcr.organization.service.IOrganizationService;
import com.healthcare.epcr.organization.service.OrganizationConfigCacheService;
import com.healthcare.epcr.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrganizationServiceImpl implements IOrganizationService {
    private final OrganizationRepository organizationRepository;
    private final AccessControlService accessControlService;
    private final OrganizationConfigCacheService organizationConfigCacheService;

    @Override
    public OrganizationDTO createOrganization(CreateOrganizationRequest request) {
        log.info("Creating organization with code: {}", request.getCode());
        try {
            if (request.getCode() == null || request.getCode().isBlank()) {
                log.error("Organization code is required");
                throw new IllegalArgumentException("Organization code is required");
            }
            if (organizationRepository.findByCode(request.getCode()).isPresent()) {
                log.warn("Organization already exists with code: {}", request.getCode());
                throw new IllegalArgumentException("Organization already exists with code: " + request.getCode());
            }
            if (request.getEmail() != null && !request.getEmail().isBlank()
                    && organizationRepository.findByEmail(request.getEmail()).isPresent()) {
                log.warn("Organization already exists with email: {}", request.getEmail());
                throw new IllegalArgumentException("Organization already exists with email: " + request.getEmail());
            }
            if (request.getPhone() != null && !request.getPhone().isBlank()
                    && organizationRepository.findByPhone(request.getPhone()).isPresent()) {
                log.warn("Organization already exists with phone: {}", request.getPhone());
                throw new IllegalArgumentException("Organization already exists with phone: " + request.getPhone());
            }

            Organization org = new Organization();
            org.setName(request.getName());
            org.setCode(request.getCode());
            org.setDescription(request.getDescription());
            org.setAddress(request.getAddress());
            org.setCity(request.getCity());
            org.setState(request.getState());
            org.setZipCode(request.getZipCode());
            org.setPhone(request.getPhone());
            org.setEmail(request.getEmail());
            org.setContactPerson(request.getContactPerson());
            org.setLicenseNumber(request.getLicenseNumber());
            org.setOrngeAuthority(Boolean.TRUE.equals(request.getOrngeAuthority()));
            org.setContractedProvider(Boolean.TRUE.equals(request.getContractedProvider()));
            org.setCreatedAt(LocalDateTime.now());
            org.setUpdatedAt(LocalDateTime.now());
            org.setActive(true);

            Organization savedOrg = organizationRepository.save(org);
            log.info("Organization created successfully with id: {} and code: {}", savedOrg.getId(), savedOrg.getCode());
            return mapToDTO(savedOrg);
        } catch (Exception e) {
            log.error("Error creating organization with code: {}", request.getCode(), e);
            throw e;
        }
    }

    @Override
    public Optional<OrganizationDTO> getOrganizationById(String id) {
        OrganizationDTO organization = organizationConfigCacheService.getOrganization(id);
        if (organization == null || !accessControlService.canAccessOrganization(organization.getId())) {
            return Optional.empty();
        }
        return Optional.of(organization);
    }

    @Override
    public Optional<OrganizationDTO> getOrganizationByCode(String code) {
        return organizationRepository.findByCode(code)
                .filter(org -> accessControlService.canAccessOrganization(org.getId()))
                .map(this::mapToDTO);
    }

    @Override
    public Page<OrganizationDTO> getAllOrganizations(Pageable pageable) {
        log.debug("Fetching all organizations with pagination");
        Page<Organization> orgsPage = organizationRepository.findAll(pageable);
        List<OrganizationDTO> visibleOrgs = new ArrayList<>();
        for (Organization org : orgsPage.getContent()) {
            if (accessControlService.canAccessOrganization(org.getId())) {
                visibleOrgs.add(mapToDTO(org));
            }
        }
        return new PageImpl<>(visibleOrgs, pageable, orgsPage.getTotalElements());
    }

    @Override
    public Page<OrganizationDTO> getActiveOrganizations(Pageable pageable) {
        log.debug("Fetching active organizations with pagination");
        Page<Organization> orgsPage = organizationRepository.findByActive(true, pageable);
        List<OrganizationDTO> visibleOrgs = new ArrayList<>();
        for (Organization org : orgsPage.getContent()) {
            if (accessControlService.canAccessOrganization(org.getId())) {
                visibleOrgs.add(mapToDTO(org));
            }
        }
        return new PageImpl<>(visibleOrgs, pageable, orgsPage.getTotalElements());
    }

     @Override
     @CacheEvict(value = "org:config", key = "#id")
     public OrganizationDTO updateOrganization(String id, CreateOrganizationRequest request) {
         Organization org = organizationRepository.findById(id)
                 .orElseThrow(() -> new ResourceNotFoundException("Organization not found with id: " + id));
         // ADMIN bypass: Allow ADMIN to update any organization
         try {
             if (!accessControlService.currentUser().getRole().equals(com.healthcare.epcr.user.model.Role.ADMIN)) {
                 accessControlService.assertOrganizationAccess(org.getId());
             }
         } catch (Exception e) {
             // If any error checking role, fall back to access control
             accessControlService.assertOrganizationAccess(org.getId());
         }

        if (request.getCode() != null && !request.getCode().isBlank()) {
            Optional<Organization> codeOwner = organizationRepository.findByCode(request.getCode());
            if (codeOwner.isPresent() && !codeOwner.get().getId().equals(id)) {
                throw new IllegalArgumentException("Organization already exists with code: " + request.getCode());
            }
            org.setCode(request.getCode());
        }
        if (request.getName() != null) org.setName(request.getName());
        if (request.getDescription() != null) org.setDescription(request.getDescription());
        if (request.getAddress() != null) org.setAddress(request.getAddress());
        if (request.getCity() != null) org.setCity(request.getCity());
        if (request.getState() != null) org.setState(request.getState());
        if (request.getZipCode() != null) org.setZipCode(request.getZipCode());
        if (request.getPhone() != null && !request.getPhone().isBlank()) {
            Optional<Organization> phoneOwner = organizationRepository.findByPhone(request.getPhone());
            if (phoneOwner.isPresent() && !phoneOwner.get().getId().equals(id)) {
                throw new IllegalArgumentException("Organization already exists with phone: " + request.getPhone());
            }
            org.setPhone(request.getPhone());
        }
        if (request.getEmail() != null && !request.getEmail().isBlank()) {
            Optional<Organization> emailOwner = organizationRepository.findByEmail(request.getEmail());
            if (emailOwner.isPresent() && !emailOwner.get().getId().equals(id)) {
                throw new IllegalArgumentException("Organization already exists with email: " + request.getEmail());
            }
            org.setEmail(request.getEmail());
        }
        if (request.getContactPerson() != null) org.setContactPerson(request.getContactPerson());
        if (request.getLicenseNumber() != null) org.setLicenseNumber(request.getLicenseNumber());
        if (request.getOrngeAuthority() != null) org.setOrngeAuthority(request.getOrngeAuthority());
        if (request.getContractedProvider() != null) org.setContractedProvider(request.getContractedProvider());

        org.setUpdatedAt(LocalDateTime.now());
        Organization updatedOrg = organizationRepository.save(org);
        return mapToDTO(updatedOrg);
    }

     @Override
     @CacheEvict(value = "org:config", key = "#id")
     public void deleteOrganization(String id) {
         Organization org = organizationRepository.findById(id)
                 .orElseThrow(() -> new ResourceNotFoundException("Organization not found with id: " + id));
         // ADMIN bypass: Allow ADMIN to delete any organization
         try {
             if (!accessControlService.currentUser().getRole().equals(com.healthcare.epcr.user.model.Role.ADMIN)) {
                 accessControlService.assertOrganizationAccess(org.getId());
             }
         } catch (Exception e) {
             // If any error checking role, fall back to access control
             accessControlService.assertOrganizationAccess(org.getId());
         }
         log.info("Deleting organization with id: {}", id);
         organizationRepository.deleteById(id);
     }

    private OrganizationDTO mapToDTO(Organization org) {
        OrganizationDTO dto = new OrganizationDTO();
        dto.setId(org.getId());
        dto.setName(org.getName());
        dto.setCode(org.getCode());
        dto.setDescription(org.getDescription());
        dto.setAddress(org.getAddress());
        dto.setCity(org.getCity());
        dto.setState(org.getState());
        dto.setZipCode(org.getZipCode());
        dto.setPhone(org.getPhone());
        dto.setEmail(org.getEmail());
        dto.setContactPerson(org.getContactPerson());
        dto.setLicenseNumber(org.getLicenseNumber());
        dto.setOrngeAuthority(org.getOrngeAuthority());
        dto.setContractedProvider(org.getContractedProvider());
        dto.setActive(org.getActive());
        dto.setCreatedAt(org.getCreatedAt());
        dto.setUpdatedAt(org.getUpdatedAt());
        return dto;
    }
}

