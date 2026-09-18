package com.healthcare.epcr.tb.service;

import com.healthcare.epcr.auditlog.service.AuditLogService;
import com.healthcare.epcr.common.exception.ResourceNotFoundException;
import com.healthcare.epcr.tb.dto.BulkContactImportResultDTO;
import com.healthcare.epcr.tb.enums.ContactInvestigationStatus;
import com.healthcare.epcr.tb.enums.ContactRiskLevel;
import com.healthcare.epcr.tb.enums.ExposureType;
import com.healthcare.epcr.tb.model.TbCase;
import com.healthcare.epcr.tb.model.TbContact;
import com.healthcare.epcr.tb.repository.TbCaseRepository;
import com.healthcare.epcr.tb.repository.TbContactRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Service to process bulk CSV contact imports for an index TB Case.
 * Satisfies RFP requirement TPH TB-CT 1.1.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BulkContactImportService {

    private final TbCaseRepository caseRepository;
    private final TbContactRepository contactRepository;
    private final AuditLogService auditLogService;

    public BulkContactImportResultDTO importContactsFromCsv(String caseId, MultipartFile file, String organizationId, String userId) {
        TbCase tbCase = caseRepository.findById(caseId)
                .filter(c -> organizationId.equals(c.getOrganizationId()))
                .orElseThrow(() -> new ResourceNotFoundException("TB Case not found: " + caseId));

        List<String> errors = new ArrayList<>();
        List<TbContact> createdContacts = new ArrayList<>();
        int totalRows = 0;

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            boolean isHeader = true;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) continue;
                if (isHeader) {
                    isHeader = false; // Skip CSV header (contactName,contactPhone,contactEmail,dateOfBirth,riskLevel,exposureType,notes)
                    continue;
                }

                totalRows++;
                String[] cols = line.split(",", -1);
                if (cols.length < 3) {
                    errors.add("Row " + totalRows + ": Invalid format (contactName, phone, riskLevel required)");
                    continue;
                }

                try {
                    String contactName = cols[0].trim();
                    String phone = cols[1].trim();
                    String email = cols.length > 2 ? cols[2].trim() : "";
                    String dob = cols.length > 3 ? cols[3].trim() : "";
                    String riskStr = cols.length > 4 ? cols[4].trim().toUpperCase() : "MEDIUM";
                    String exposureStr = cols.length > 5 ? cols[5].trim().toUpperCase() : "HOUSEHOLD";
                    String notes = cols.length > 6 ? cols[6].trim() : "Bulk imported contact";

                    if (contactName.isEmpty()) {
                        errors.add("Row " + totalRows + ": contactName is required");
                        continue;
                    }

                    ContactRiskLevel riskLevel;
                    try {
                        riskLevel = ContactRiskLevel.valueOf(riskStr);
                    } catch (Exception e) {
                        riskLevel = ContactRiskLevel.MEDIUM;
                    }

                    ExposureType exposureType;
                    try {
                        exposureType = ExposureType.valueOf(exposureStr);
                    } catch (Exception e) {
                        exposureType = ExposureType.HOUSEHOLD;
                    }

                    TbContact contact = new TbContact();
                    contact.setIndexCaseId(caseId);
                    contact.setOrganizationId(organizationId);
                    contact.setContactName(contactName);
                    contact.setContactPhone(phone);
                    contact.setContactEmail(email);
                    contact.setDateOfBirth(dob);
                    contact.setRiskLevel(riskLevel);
                    contact.setExposureType(exposureType);
                    contact.setInvestigationStatus(ContactInvestigationStatus.IDENTIFIED);
                    contact.setNotes(notes);
                    contact.setCreatedBy(userId);
                    contact.setCreatedAt(java.time.Instant.now());

                    TbContact saved = contactRepository.save(contact);
                    createdContacts.add(saved);
                } catch (Exception e) {
                    errors.add("Row " + totalRows + ": " + e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("Failed to parse contacts CSV for case {}", caseId, e);
            errors.add("File parsing error: " + e.getMessage());
        }

        auditLogService.logAction(
                userId,
                "BULK_IMPORT_TB_CONTACTS",
                "TbCase",
                caseId,
                "Imported " + createdContacts.size() + " contacts for TB Case " + caseId + " from CSV (" + file.getOriginalFilename() + ")"
        );

        return BulkContactImportResultDTO.builder()
                .caseId(caseId)
                .totalRows(totalRows)
                .successCount(createdContacts.size())
                .failureCount(totalRows - createdContacts.size())
                .createdContacts(createdContacts)
                .errors(errors)
                .build();
    }
}
