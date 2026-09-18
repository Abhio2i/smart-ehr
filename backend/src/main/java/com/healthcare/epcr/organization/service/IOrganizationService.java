package com.healthcare.epcr.organization.service;

import com.healthcare.epcr.organization.dto.OrganizationDTO;
import com.healthcare.epcr.organization.dto.CreateOrganizationRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.util.List;
import java.util.Optional;

public interface IOrganizationService {
    OrganizationDTO createOrganization(CreateOrganizationRequest request);
    Optional<OrganizationDTO> getOrganizationById(String id);
    Optional<OrganizationDTO> getOrganizationByCode(String code);
    Page<OrganizationDTO> getAllOrganizations(Pageable pageable);
    Page<OrganizationDTO> getActiveOrganizations(Pageable pageable);
    OrganizationDTO updateOrganization(String id, CreateOrganizationRequest request);
    void deleteOrganization(String id);
}


