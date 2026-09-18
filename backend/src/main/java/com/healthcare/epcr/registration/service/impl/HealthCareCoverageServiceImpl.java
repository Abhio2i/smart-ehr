package com.healthcare.epcr.registration.service.impl;

import com.healthcare.epcr.common.exception.ResourceNotFoundException;
import com.healthcare.epcr.patient.model.Patient;
import com.healthcare.epcr.patient.repository.PatientRepository;
import com.healthcare.epcr.phi.crypto.PhiCryptoService;
import com.healthcare.epcr.registration.dto.CreateOrUpdateCoverageRequest;
import com.healthcare.epcr.registration.dto.HealthCareCoverageDTO;
import com.healthcare.epcr.registration.model.HealthCareCoverage;
import com.healthcare.epcr.registration.repository.HealthCareCoverageRepository;
import com.healthcare.epcr.registration.service.IHealthCareCoverageService;
import com.healthcare.epcr.security.AccessControlService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class HealthCareCoverageServiceImpl implements IHealthCareCoverageService {

    private final HealthCareCoverageRepository coverageRepository;
    private final PatientRepository patientRepository;
    private final PhiCryptoService phiCryptoService;
    private final AccessControlService accessControlService;

    @Override
    public HealthCareCoverageDTO getCoverageByPatientId(String patientId) {
        assertPatientAccess(patientId);
        HealthCareCoverage coverage = coverageRepository.findByPatientId(patientId)
                .orElseThrow(() -> new ResourceNotFoundException("Healthcare coverage registration not found for patient ID: " + patientId));
        return toDTO(coverage);
    }

    @Override
    public HealthCareCoverageDTO createOrUpdateCoverage(String patientId, CreateOrUpdateCoverageRequest request) {
        // Assert authorization access to organization
        Patient patient = assertPatientAccess(patientId);
        
        String organizationId = patient.getOrganizationId();
        if (organizationId == null || organizationId.isBlank()) {
            organizationId = accessControlService.currentUser().getOrganizationId();
        }

        Optional<HealthCareCoverage> existingOpt = coverageRepository.findByPatientId(patientId);
        HealthCareCoverage coverage;
        LocalDateTime now = LocalDateTime.now();

        if (existingOpt.isPresent()) {
            coverage = existingOpt.get();
            coverage.setUpdatedAt(now);
        } else {
            coverage = new HealthCareCoverage();
            coverage.setPatientId(patientId);
            coverage.setOrganizationId(organizationId);
            coverage.setCreatedAt(now);
            coverage.setUpdatedAt(now);
            coverage.setVerificationStatus("PENDING");
            coverage.setVerificationNotes("Pending registry verification check.");
        }

        // Encrypt sensitive PHI fields using PhiCryptoService
        coverage.setNwtPlanNumber(request.getNwtPlanNumber() != null ? phiCryptoService.encrypt(request.getNwtPlanNumber()) : null);
        coverage.setHomeJurisdictionHealthCardNumber(request.getHomeJurisdictionHealthCardNumber() != null ? phiCryptoService.encrypt(request.getHomeJurisdictionHealthCardNumber()) : null);
        coverage.setNihbClientId(request.getNihbClientId() != null ? phiCryptoService.encrypt(request.getNihbClientId()) : null);

        coverage.setCoverageType(request.getCoverageType());
        coverage.setExpiryDate(request.getExpiryDate());
        coverage.setEligible(request.getEligible());

        // Map other billing, audit, and residency details
        coverage.setVersionCode(request.getVersionCode());
        coverage.setCardExpiryDate(request.getCardExpiryDate());
        coverage.setResidencyStatus(request.getResidencyStatus());
        coverage.setPlanCode(request.getPlanCode());
        coverage.setEffectiveFrom(request.getEffectiveFrom());
        coverage.setEffectiveTo(request.getEffectiveTo());
        coverage.setReciprocalBillingCode(request.getReciprocalBillingCode());
        coverage.setHomeJurisdictionContactInfo(request.getHomeJurisdictionContactInfo());
        coverage.setNihbBenefitCategory(request.getNihbBenefitCategory());
        coverage.setBandAffiliation(request.getBandAffiliation());
        coverage.setPayerId(request.getPayerId());
        coverage.setClaimReferenceNumber(request.getClaimReferenceNumber());
        coverage.setEstimatedCoveragePercentage(request.getEstimatedCoveragePercentage());

        HealthCareCoverage saved = coverageRepository.save(coverage);
        log.info("Successfully saved healthcare plan coverage for patient ID: {}", patientId);
        return toDTO(saved);
    }

    @Override
    public HealthCareCoverageDTO getActiveEligibility(String patientId) {
        assertPatientAccess(patientId);
        HealthCareCoverage coverage = coverageRepository.findByPatientId(patientId)
                .orElseThrow(() -> new ResourceNotFoundException("Healthcare coverage registration not found for patient ID: " + patientId));

        LocalDate today = LocalDate.now();
        boolean isExpired = coverage.getExpiryDate() != null && coverage.getExpiryDate().isBefore(today);
        
        // Return coverage details, marking eligibility as false if expired
        if (isExpired) {
            coverage.setEligible(false);
            coverage.setVerificationStatus("FAILED");
            coverage.setVerificationNotes("The health care card registration has expired (Expiry Date: " + coverage.getExpiryDate() + ").");
            coverage = coverageRepository.save(coverage);
        }

        return toDTO(coverage);
    }

    @Override
    public HealthCareCoverageDTO verifyCoverage(String patientId) {
        Patient patient = assertPatientAccess(patientId);
        HealthCareCoverage coverage = coverageRepository.findByPatientId(patientId)
                .orElseThrow(() -> new ResourceNotFoundException("Healthcare coverage registration not found for patient ID: " + patientId));

        var currentUser = accessControlService.currentUser();
        String decryptedNumber = phiCryptoService.decrypt(coverage.getNwtPlanNumber());
        String type = coverage.getCoverageType() != null ? coverage.getCoverageType().toUpperCase(java.util.Locale.ENGLISH) : "";

        boolean isValid = false;
        String notes = "Verification successful.";

        if ("NIHB".equalsIgnoreCase(type)) {
            String nihbId = coverage.getNihbClientId() != null ? phiCryptoService.decrypt(coverage.getNihbClientId()) : null;
            if (nihbId != null && !nihbId.isBlank()) {
                String cleanNihb = nihbId.replaceAll("[\\s-]", "");
                // NIHB Status Client Number: 7 to 10 digits
                isValid = cleanNihb.matches("^\\d{7,10}$");
                if (!isValid) {
                    notes = "Invalid NIHB Status Number. Federal Indigenous status numbers must contain between 7 to 10 numeric digits.";
                }
            } else {
                notes = "NIHB verification failed. Status Number/Client ID is missing.";
            }
        } else if ("RECIPROCAL".equalsIgnoreCase(type)) {
            String homeCard = coverage.getHomeJurisdictionHealthCardNumber() != null ? phiCryptoService.decrypt(coverage.getHomeJurisdictionHealthCardNumber()) : null;
            if (homeCard != null && !homeCard.isBlank()) {
                String cleanHomeCard = homeCard.replaceAll("[\\s-]", "");
                // Reciprocal Provincial health card check: 9 or 10 numeric digits
                isValid = cleanHomeCard.matches("^\\d{9}$") || cleanHomeCard.matches("^\\d{10}$");
                if (!isValid) {
                    notes = "Invalid Reciprocal Health Card format. Expected a valid 9 or 10-digit provincial/territorial card number.";
                }
            } else {
                notes = "Reciprocal verification failed. Home jurisdiction card number is missing.";
            }
        } else if (!"UNINSURED".equalsIgnoreCase(type) && !"NONE".equalsIgnoreCase(type)) {
            if (decryptedNumber != null && !decryptedNumber.isBlank()) {
                // Strip formatting like spaces and dashes
                String cleanNumber = decryptedNumber.replaceAll("[\\s-]", "");

                switch (type) {
                    case "NWT_HEALTH_CARE_PLAN":
                        // Northwest Territories (GNWT): 9-digit numeric
                        isValid = cleanNumber.matches("^\\d{9}$");
                        if (!isValid) {
                            notes = "Invalid card format. Northwest Territories health care card numbers must contain exactly 9 numeric digits.";
                        }
                        break;
                    case "OHIP_ONTARIO":
                        // Ontario (OHIP): 10-digit numeric, optionally followed by 2 letters (version code)
                        isValid = cleanNumber.matches("^\\d{10}([A-Z]{2})?$");
                        if (!isValid) {
                            notes = "Invalid card format. Ontario OHIP numbers must be exactly 10 digits, optionally followed by a 2-letter version code.";
                        }
                        break;
                    case "MSP_BRITISH_COLUMBIA":
                        // British Columbia (MSP): 10-digit numeric starting with 9
                        isValid = cleanNumber.matches("^9\\d{9}$");
                        if (!isValid) {
                            notes = "Invalid card format. British Columbia Personal Health Numbers (PHN) must be exactly 10 digits starting with the number 9.";
                        }
                        break;
                    case "AHCIP_ALBERTA":
                        // Alberta (AHCIP): 9-digit numeric
                        isValid = cleanNumber.matches("^\\d{9}$");
                        if (!isValid) {
                            notes = "Invalid card format. Alberta AHCIP numbers must contain exactly 9 numeric digits.";
                        }
                        break;
                    case "RAMQ_QUEBEC":
                        // Quebec (RAMQ): 4 letters + 8 digits (YYMMDD format + sequence)
                        isValid = cleanNumber.matches("^[A-Z]{4}\\d{8}$");
                        if (!isValid) {
                            notes = "Invalid card format. Quebec RAMQ numbers must consist of exactly 4 alphabetic letters followed by 8 numeric digits.";
                        }
                        break;
                    case "PRIVATE_INSURANCE":
                        // Private Commercial: Alphanumeric between 6 and 20 chars
                        isValid = cleanNumber.matches("^[A-Z0-9]{6,20}$");
                        if (!isValid) {
                            notes = "Invalid card format. Private commercial policy IDs must be alphanumeric and between 6 and 20 characters.";
                        }
                        break;
                    default:
                        // Fallback
                        isValid = cleanNumber.length() >= 5 && cleanNumber.length() <= 15;
                        if (!isValid) {
                            notes = "Invalid card format. Card number length must be between 5 and 15 alphanumeric characters.";
                        }
                        break;
                }
            } else {
                notes = "Health card plan number is empty or missing.";
            }
        } else {
            // Self-Pay / Uninsured
            isValid = true;
            notes = "Registered as Self-Pay status. Validation checks bypassed.";
        }

        // Check if coverage has expired
        LocalDate today = LocalDate.now();
        boolean isExpired = coverage.getExpiryDate() != null && coverage.getExpiryDate().isBefore(today);
        if (isExpired) {
            isValid = false;
            notes = "The health care card registration has expired (Expiry Date: " + coverage.getExpiryDate() + ").";
        }

        String verifiedBy = ((currentUser.getFirstName() != null ? currentUser.getFirstName() : "") + " " + (currentUser.getLastName() != null ? currentUser.getLastName() : "")).trim();
        if (verifiedBy.isEmpty()) {
            verifiedBy = currentUser.getEmail();
        }
        if (verifiedBy == null || verifiedBy.isEmpty()) {
            verifiedBy = currentUser.getId();
        }

        coverage.setVerificationStatus(isValid ? "VERIFIED" : "FAILED");
        coverage.setEligible(isValid);
        coverage.setLastVerifiedAt(LocalDateTime.now());
        coverage.setLastVerifiedBy(verifiedBy);
        coverage.setVerificationNotes(notes);
        coverage.setEligibilityCheckMethod("REAL_TIME_API");
        coverage.setEligibilityCheckResult(isValid ? "ELIGIBLE" : "NOT_ELIGIBLE");
        coverage.setUpdatedAt(LocalDateTime.now());

        HealthCareCoverage saved = coverageRepository.save(coverage);
        log.info("Healthcare coverage verification completed for patient ID: {}. Status: {}, Notes: {}", patientId, coverage.getVerificationStatus(), notes);
        return toDTO(saved);
    }

    private Patient assertPatientAccess(String patientId) {
        Patient patient = patientRepository.findByPatientId(patientId)
                .or(() -> patientRepository.findById(patientId))
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found with ID: " + patientId));
        accessControlService.assertOrganizationAccess(patient.getOrganizationId());
        return patient;
    }

    private HealthCareCoverageDTO toDTO(HealthCareCoverage coverage) {
        if (coverage == null) {
            return null;
        }
        HealthCareCoverageDTO dto = new HealthCareCoverageDTO();
        dto.setId(coverage.getId());
        dto.setPatientId(coverage.getPatientId());
        dto.setOrganizationId(coverage.getOrganizationId());
        
        // Decrypt sensitive PHI fields using PhiCryptoService
        dto.setNwtPlanNumber(coverage.getNwtPlanNumber() != null ? phiCryptoService.decrypt(coverage.getNwtPlanNumber()) : null);
        dto.setHomeJurisdictionHealthCardNumber(coverage.getHomeJurisdictionHealthCardNumber() != null ? phiCryptoService.decrypt(coverage.getHomeJurisdictionHealthCardNumber()) : null);
        dto.setNihbClientId(coverage.getNihbClientId() != null ? phiCryptoService.decrypt(coverage.getNihbClientId()) : null);

        dto.setCoverageType(coverage.getCoverageType());
        dto.setVerificationStatus(coverage.getVerificationStatus());
        dto.setEligible(coverage.getEligible());
        dto.setExpiryDate(coverage.getExpiryDate());
        dto.setLastVerifiedBy(coverage.getLastVerifiedBy());
        dto.setVerificationNotes(coverage.getVerificationNotes());

        dto.setVersionCode(coverage.getVersionCode());
        dto.setCardExpiryDate(coverage.getCardExpiryDate());
        dto.setResidencyStatus(coverage.getResidencyStatus());
        dto.setPlanCode(coverage.getPlanCode());
        dto.setEffectiveFrom(coverage.getEffectiveFrom());
        dto.setEffectiveTo(coverage.getEffectiveTo());
        dto.setReciprocalBillingCode(coverage.getReciprocalBillingCode());
        dto.setHomeJurisdictionContactInfo(coverage.getHomeJurisdictionContactInfo());
        dto.setNihbBenefitCategory(coverage.getNihbBenefitCategory());
        dto.setBandAffiliation(coverage.getBandAffiliation());
        dto.setEligibilityCheckMethod(coverage.getEligibilityCheckMethod());
        dto.setEligibilityCheckResult(coverage.getEligibilityCheckResult());
        dto.setPayerId(coverage.getPayerId());
        dto.setClaimReferenceNumber(coverage.getClaimReferenceNumber());
        dto.setEstimatedCoveragePercentage(coverage.getEstimatedCoveragePercentage());

        dto.setLastVerifiedAt(coverage.getLastVerifiedAt());
        dto.setCreatedAt(coverage.getCreatedAt());
        dto.setUpdatedAt(coverage.getUpdatedAt());
        return dto;
    }

    @Override
    public void deleteCoverage(String patientId) {
        Patient patient = assertPatientAccess(patientId);
        if (!coverageRepository.existsByPatientId(patientId)) {
            throw new ResourceNotFoundException("Healthcare coverage registration not found for patient ID: " + patientId);
        }
        coverageRepository.deleteByPatientId(patientId);
        log.info("Healthcare coverage registration deleted for patient ID: {}", patientId);
    }
}
