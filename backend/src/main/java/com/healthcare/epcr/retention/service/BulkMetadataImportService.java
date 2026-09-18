package com.healthcare.epcr.retention.service;

import com.healthcare.epcr.auditlog.service.AuditLogService;
import com.healthcare.epcr.retention.dto.BulkMetadataImportResult;
import com.healthcare.epcr.retention.model.RetentionRule;
import com.healthcare.epcr.retention.repository.RetentionRuleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Service to process bulk metadata imports (CSV and XML) for retention rules and metadata elements.
 * Satisfies RFP requirement CIMS-Meta 1.4.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BulkMetadataImportService {

    private final RetentionRuleRepository ruleRepository;
    private final AuditLogService auditLogService;

    public BulkMetadataImportResult importMetadataFile(MultipartFile file, String organizationId, String userId, String userName) {
        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "file";
        log.info("Processing bulk metadata import for file: {}, org: {}", filename, organizationId);

        if (filename.toLowerCase().endsWith(".xml")) {
            return processXmlFile(file, organizationId, userId, userName);
        } else {
            return processCsvFile(file, organizationId, userId, userName);
        }
    }

    private BulkMetadataImportResult processCsvFile(MultipartFile file, String organizationId, String userId, String userName) {
        List<String> errors = new ArrayList<>();
        List<String> importedNames = new ArrayList<>();
        int total = 0;
        int success = 0;

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            boolean isHeader = true;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) continue;
                if (isHeader) {
                    isHeader = false; // Skip CSV header row (policyName,retentionPeriodYears,actionAfterPeriod,description)
                    continue;
                }

                total++;
                String[] cols = line.split(",", -1);
                if (cols.length < 3) {
                    errors.add("Row " + total + ": Invalid format (must have policyName, retentionPeriodYears, actionAfterPeriod)");
                    continue;
                }

                try {
                    String policyName = cols[0].trim();
                    int periodYears = Integer.parseInt(cols[1].trim());
                    String action = cols[2].trim().toUpperCase();
                    String description = cols.length > 3 ? cols[3].trim() : "Bulk imported metadata rule";

                    if (policyName.isEmpty()) {
                        errors.add("Row " + total + ": Policy name cannot be empty");
                        continue;
                    }

                    RetentionRule rule = new RetentionRule();
                    rule.setOrganizationId(organizationId);
                    rule.setPolicyName(policyName);
                    rule.setRetentionPeriodYears(periodYears);
                    rule.setActionAfterPeriod(action);
                    rule.setDescription(description);
                    rule.setCreatedAt(Instant.now());
                    rule.setCreatedBy(userName);

                    ruleRepository.save(rule);
                    importedNames.add(policyName);
                    success++;
                } catch (NumberFormatException e) {
                    errors.add("Row " + total + ": Invalid retentionPeriodYears value");
                } catch (Exception e) {
                    errors.add("Row " + total + ": " + e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("Failed to parse CSV file", e);
            errors.add("File parsing error: " + e.getMessage());
        }

        auditLogService.logAction(
                userId,
                "BULK_METADATA_IMPORT_CSV",
                "RetentionRule",
                "BULK",
                "Imported " + success + " retention metadata rules from CSV (" + file.getOriginalFilename() + ")"
        );

        return BulkMetadataImportResult.builder()
                .totalProcessed(total)
                .successCount(success)
                .failureCount(total - success)
                .importedPolicyNames(importedNames)
                .errors(errors)
                .build();
    }

    private BulkMetadataImportResult processXmlFile(MultipartFile file, String organizationId, String userId, String userName) {
        List<String> errors = new ArrayList<>();
        List<String> importedNames = new ArrayList<>();
        int total = 0;
        int success = 0;

        try (InputStream is = file.getInputStream()) {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true); // XXE protection
            DocumentBuilder builder = factory.newDocumentBuilder();
            Document doc = builder.parse(is);

            NodeList nodeList = doc.getElementsByTagName("rule");
            total = nodeList.getLength();

            for (int i = 0; i < total; i++) {
                Node node = nodeList.item(i);
                if (node.getNodeType() == Node.ELEMENT_NODE) {
                    Element elem = (Element) node;
                    try {
                        String policyName = getTagValue("policyName", elem);
                        String periodStr = getTagValue("retentionPeriodYears", elem);
                        String action = getTagValue("actionAfterPeriod", elem);
                        String description = getTagValue("description", elem);

                        if (policyName == null || policyName.isBlank()) {
                            errors.add("XML Item " + (i + 1) + ": policyName is missing");
                            continue;
                        }

                        int periodYears = Integer.parseInt(periodStr != null ? periodStr.trim() : "7");

                        RetentionRule rule = new RetentionRule();
                        rule.setOrganizationId(organizationId);
                        rule.setPolicyName(policyName.trim());
                        rule.setRetentionPeriodYears(periodYears);
                        rule.setActionAfterPeriod(action != null ? action.trim().toUpperCase() : "ARCHIVE");
                        rule.setDescription(description != null ? description.trim() : "Bulk imported metadata rule from XML");
                        rule.setCreatedAt(Instant.now());
                        rule.setCreatedBy(userName);

                        ruleRepository.save(rule);
                        importedNames.add(policyName);
                        success++;
                    } catch (Exception e) {
                        errors.add("XML Item " + (i + 1) + ": " + e.getMessage());
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed to parse XML file", e);
            errors.add("XML parsing error: " + e.getMessage());
        }

        auditLogService.logAction(
                userId,
                "BULK_METADATA_IMPORT_XML",
                "RetentionRule",
                "BULK",
                "Imported " + success + " retention metadata rules from XML (" + file.getOriginalFilename() + ")"
        );

        return BulkMetadataImportResult.builder()
                .totalProcessed(total)
                .successCount(success)
                .failureCount(total - success)
                .importedPolicyNames(importedNames)
                .errors(errors)
                .build();
    }

    private String getTagValue(String tag, Element element) {
        NodeList nodeList = element.getElementsByTagName(tag);
        if (nodeList != null && nodeList.getLength() > 0) {
            Node node = nodeList.item(0);
            if (node != null) {
                return node.getTextContent();
            }
        }
        return null;
    }
}
