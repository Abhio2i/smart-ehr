package com.healthcare.epcr.hipaa.baa.service;

import com.healthcare.epcr.hipaa.baa.model.BusinessAssociate;
import com.healthcare.epcr.hipaa.baa.repository.BusinessAssociateRepository;
import com.healthcare.epcr.security.AccessControlService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class BaaService {
    private final BusinessAssociateRepository repository;
    private final AccessControlService accessControlService;

    public BusinessAssociate create(Map<String, String> body) {
        accessControlService.assertOrganizationAccess(body.get("organizationId"));
        BusinessAssociate assoc = new BusinessAssociate();
        assoc.setOrganizationId(body.get("organizationId"));
        assoc.setVendorName(body.get("vendorName"));
        assoc.setServiceType(body.get("serviceType"));
        assoc.setBaaStatus("PENDING");
        assoc.setDocumentRef(body.get("documentRef"));
        assoc.setCreatedAt(LocalDateTime.now());
        assoc.setUpdatedAt(LocalDateTime.now());
        return repository.save(assoc);
    }

    public List<BusinessAssociate> list(String organizationId) {
        accessControlService.assertOrganizationAccess(organizationId);
        return repository.findByOrganizationIdOrderByCreatedAtDesc(organizationId);
    }

    public BusinessAssociate get(String id) {
        return repository.findById(id).orElseThrow(() -> new IllegalArgumentException("Vendor not found"));
    }

    public BusinessAssociate updateStatus(String id, String status) {
        BusinessAssociate assoc = get(id);
        accessControlService.assertOrganizationAccess(assoc.getOrganizationId());
        assoc.setBaaStatus(status);
        assoc.setUpdatedAt(LocalDateTime.now());
        return repository.save(assoc);
    }

    public void assertActiveBaa(String vendorId) {
        BusinessAssociate assoc = get(vendorId);
        if (!"ACTIVE".equalsIgnoreCase(assoc.getBaaStatus())) {
            throw new IllegalArgumentException("BAA is not active for vendor: " + vendorId);
        }
    }
}

