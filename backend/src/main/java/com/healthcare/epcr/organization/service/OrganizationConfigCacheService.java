package com.healthcare.epcr.organization.service;

import com.healthcare.epcr.organization.dto.OrganizationDTO;
import com.healthcare.epcr.organization.model.Organization;
import com.healthcare.epcr.organization.repository.OrganizationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class OrganizationConfigCacheService {
    private final OrganizationRepository organizationRepository;

    @Cacheable(value = "org:config", key = "#orgId", unless = "#result == null")
    public OrganizationDTO getOrganization(String orgId) {
        if (orgId == null || orgId.isBlank()) {
            return null;
        }
        return organizationRepository.findById(orgId)
                .map(this::mapToDTO)
                .orElse(null);
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
