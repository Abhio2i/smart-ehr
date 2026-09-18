package com.healthcare.epcr.cfs.service;

import com.healthcare.epcr.cfs.dto.*;
import com.healthcare.epcr.cfs.entity.*;
import com.healthcare.epcr.cfs.repository.*;
import com.healthcare.epcr.phi.crypto.PhiCryptoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class ChildFamilyServicesService {

    @Autowired
    private ChildFamilyCaseRepository caseRepository;

    @Autowired
    private FosterHomeRepository fosterHomeRepository;

    @Autowired
    private ChildPlacementRepository placementRepository;

    @Autowired
    private AdoptionCaseRepository adoptionCaseRepository;

    @Autowired
    private PhiCryptoService phiCryptoService;

    // ── Case Management ───────────────────────────────────────────────────────
    public ChildFamilyCase createCase(CreateChildFamilyCaseRequest request, String organizationId, String workerId) {
        ChildFamilyCase cfsCase = new ChildFamilyCase();
        cfsCase.setCaseNumber("CFS-" + System.currentTimeMillis() % 1000000);
        cfsCase.setOrganizationId(organizationId != null ? organizationId : "org123");
        cfsCase.setChildPatientId(request.getChildPatientId());
        cfsCase.setChildName(request.getChildName());
        cfsCase.setDateOfBirth(request.getDateOfBirth());
        cfsCase.setGender(request.getGender());
        cfsCase.setIndigenousCommunity(request.getIndigenousCommunity());

        cfsCase.setProtectionRiskLevel(request.getProtectionRiskLevel() != null ? request.getProtectionRiskLevel() : "LOW");
        cfsCase.setLegalCustodyStatus(request.getLegalCustodyStatus() != null ? request.getLegalCustodyStatus() : "VOLUNTARY_CARE_AGREEMENT");
        cfsCase.setAssignedSocialWorkerId(request.getAssignedSocialWorkerId() != null ? request.getAssignedSocialWorkerId() : workerId);
        cfsCase.setAssignedCommunityFacilityId(request.getAssignedCommunityFacilityId() != null ? request.getAssignedCommunityFacilityId() : "Yellowknife CFS Office");

        cfsCase.setProtectionConcerns(request.getProtectionConcerns());
        cfsCase.setEmergencyContact(request.getEmergencyContact());

        if (request.getFamilySafetyPlan() != null && !request.getFamilySafetyPlan().isBlank()) {
            cfsCase.setFamilySafetyPlanEncrypted(phiCryptoService.encrypt(request.getFamilySafetyPlan()));
        } else {
            cfsCase.setFamilySafetyPlanEncrypted(phiCryptoService.encrypt("Standard community safety and wellness plan."));
        }

        return caseRepository.save(cfsCase);
    }

    public Page<ChildFamilyCase> getCases(String status, Pageable pageable) {
        if (status != null && !status.equalsIgnoreCase("ALL")) {
            return caseRepository.findByCaseStatus(status, pageable);
        }
        return caseRepository.findAll(pageable);
    }

    public Optional<ChildFamilyCase> getCaseById(String id) {
        return caseRepository.findById(id).map(this::decryptCaseDetails);
    }

    public ChildFamilyCase updateCaseStatus(String id, String status, String riskLevel) {
        ChildFamilyCase cfsCase = caseRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("CFS Case not found: " + id));
        if (status != null) cfsCase.setCaseStatus(status);
        if (riskLevel != null) cfsCase.setProtectionRiskLevel(riskLevel);
        cfsCase.setUpdatedAt(Instant.now());
        return caseRepository.save(cfsCase);
    }

    private ChildFamilyCase decryptCaseDetails(ChildFamilyCase cfsCase) {
        if (cfsCase.getFamilySafetyPlanEncrypted() != null) {
            cfsCase.setFamilySafetyPlanEncrypted(phiCryptoService.decrypt(cfsCase.getFamilySafetyPlanEncrypted()));
        }
        return cfsCase;
    }

    // ── Foster Home & Placements ──────────────────────────────────────────────
    public FosterHome registerFosterHome(RegisterFosterHomeRequest request, String organizationId) {
        FosterHome home = new FosterHome();
        home.setHomeLicenseNumber("FH-NWT-" + (System.currentTimeMillis() % 10000));
        home.setOrganizationId(organizationId != null ? organizationId : "org123");
        home.setPrimaryCaregiverName(request.getPrimaryCaregiverName());
        home.setSecondaryCaregiverName(request.getSecondaryCaregiverName());
        home.setHomeType(request.getHomeType() != null ? request.getHomeType() : "REGULAR_FOSTER_HOME");
        home.setCommunity(request.getCommunity());
        home.setRegion(request.getRegion() != null ? request.getRegion() : "Yellowknife / North Slave");
        home.setMaxChildCapacity(request.getMaxChildCapacity() > 0 ? request.getMaxChildCapacity() : 2);
        home.setContactPhone(request.getContactPhone());

        return fosterHomeRepository.save(home);
    }

    public List<FosterHome> getAllFosterHomes() {
        return fosterHomeRepository.findAll();
    }

    public ChildPlacement createPlacement(String caseId, CreatePlacementRequest request, String workerId) {
        ChildFamilyCase cfsCase = caseRepository.findById(caseId)
                .orElseThrow(() -> new RuntimeException("CFS Case not found: " + caseId));
        FosterHome home = fosterHomeRepository.findById(request.getFosterHomeId())
                .orElseThrow(() -> new RuntimeException("Foster Home not found: " + request.getFosterHomeId()));

        ChildPlacement placement = new ChildPlacement();
        placement.setCfsCaseId(caseId);
        placement.setFosterHomeId(request.getFosterHomeId());
        placement.setPlacementType(request.getPlacementType() != null ? request.getPlacementType() : "LICENSED_FOSTER");
        placement.setPlacementStartDate(request.getPlacementStartDate() != null ? request.getPlacementStartDate() : Instant.now().toString());
        placement.setMonthlyStipendAmount(request.getMonthlyStipendAmount() > 0 ? request.getMonthlyStipendAmount() : 1200.00);
        placement.setSupervisingWorkerId(workerId);

        if (request.getNotes() != null) {
            placement.setPlacementNotesEncrypted(phiCryptoService.encrypt(request.getNotes()));
        }

        // Update case status & foster home placement count
        cfsCase.setCaseStatus("FOSTER_PLACEMENT");
        caseRepository.save(cfsCase);

        home.setCurrentPlacementCount(home.getCurrentPlacementCount() + 1);
        fosterHomeRepository.save(home);

        return placementRepository.save(placement);
    }

    public List<ChildPlacement> getPlacementsForCase(String caseId) {
        List<ChildPlacement> list = placementRepository.findByCfsCaseId(caseId);
        list.forEach(p -> {
            if (p.getPlacementNotesEncrypted() != null) {
                p.setPlacementNotesEncrypted(phiCryptoService.decrypt(p.getPlacementNotesEncrypted()));
            }
        });
        return list;
    }

    // ── Adoptions ─────────────────────────────────────────────────────────────
    public AdoptionCase createAdoption(CreateAdoptionRequest request) {
        AdoptionCase adoption = new AdoptionCase();
        adoption.setAdoptionFileNumber("ADP-NWT-" + System.currentTimeMillis() % 10000);
        adoption.setCfsCaseId(request.getCfsCaseId());
        adoption.setChildPatientId(request.getChildPatientId());
        adoption.setAdoptionType(request.getAdoptionType() != null ? request.getAdoptionType() : "CUSTOM_INDIGENOUS_ADOPTION");
        adoption.setAdoptiveParentNames(request.getAdoptiveParentNames());
        adoption.setCommunity(request.getCommunity());
        adoption.setRegion(request.getRegion());
        adoption.setCustomAdoptionCommissionerName(request.getCustomAdoptionCommissionerName());
        adoption.setBandCouncilSupportReceived(request.isBandCouncilSupportReceived());

        if (request.getCfsCaseId() != null) {
            caseRepository.findById(request.getCfsCaseId()).ifPresent(c -> {
                c.setCaseStatus("ADOPTION_PENDING");
                caseRepository.save(c);
            });
        }

        return adoptionCaseRepository.save(adoption);
    }

    public Page<AdoptionCase> getAdoptions(Pageable pageable) {
        return adoptionCaseRepository.findAll(pageable);
    }
}
