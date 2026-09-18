package com.healthcare.epcr.billing.service;

import com.healthcare.epcr.billing.model.BillingServiceCode;
import com.healthcare.epcr.billing.model.ClaimItem;
import com.healthcare.epcr.billing.model.HealthCareClaim;
import com.healthcare.epcr.billing.repository.BillingServiceCodeRepository;
import com.healthcare.epcr.billing.repository.HealthCareClaimRepository;
import com.healthcare.epcr.registration.model.HealthCareCoverage;
import com.healthcare.epcr.registration.repository.HealthCareCoverageRepository;
import com.healthcare.epcr.epcr.model.PatientCareRecord;
import com.healthcare.epcr.epcr.repository.PatientCareRecordRepository;
import com.healthcare.epcr.hl7.model.Hospital;
import com.healthcare.epcr.hl7.repository.HospitalRepository;
import com.healthcare.epcr.organization.model.Organization;
import com.healthcare.epcr.organization.repository.OrganizationRepository;
import com.healthcare.epcr.phi.crypto.PhiCryptoService;

import org.springframework.data.mongodb.core.MongoTemplate;

import com.healthcare.epcr.notification.service.EmailService;
import com.healthcare.epcr.patient.repository.PatientRepository;

import com.healthcare.epcr.billing.security.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class BillingClaimsService {

    private final HealthCareClaimRepository claimRepository;
    private final BillingServiceCodeRepository serviceCodeRepository;
    private final HealthCareCoverageRepository coverageRepository;
    private final PatientCareRecordRepository epcrRepository;
    private final HospitalRepository hospitalRepository;
    private final OrganizationRepository organizationRepository;
    private final PhiCryptoService phiCryptoService;
    private final MongoTemplate mongoTemplate;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private EmailService emailService;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private PatientRepository patientRepository;

    @Value("${app.frontend.base-url:http://localhost:5173/epcr}")
    private String frontendBaseUrl;

    /** Escapes characters that are special in XML attributes to prevent injection. */
    private static String xmlEscape(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&apos;");
    }

    // Basic sanity-check patterns. Tune these to NWT's real formats once confirmed.
    private static final Pattern NWT_PLAN_PATTERN = Pattern.compile("^NWT-\\d{5}-\\d{2}$");
    private static final Pattern RECIPROCAL_CODE_PATTERN = Pattern.compile("^[A-Z]{2}-\\d{6,10}$");

    // -----------------------------------------------------------------
    // STEP 1: TRIGGER — call this one line from QAService after a review
    // is marked passed/approved.
    // -----------------------------------------------------------------
    public HealthCareClaim generateClaimFromRecord(String recordId) {

        // Idempotency: don't create a duplicate DRAFT if one already exists for this record
        Optional<HealthCareClaim> existing = claimRepository.findByPatientCareRecordId(recordId);
        if (existing.isPresent()) {
            log.info("Claim already exists for record {}, skipping generation", recordId);
            return existing.get();
        }

        PatientCareRecord record = epcrRepository.findById(recordId)
                .orElseThrow(() -> new IllegalArgumentException("ePCR record not found: " + recordId));

        HealthCareCoverage coverage = coverageRepository.findByPatientId(record.getPatientId())
                .orElse(null);

        List<ClaimItem> items = buildClaimItems(record);
        double totalAmount = items.stream().mapToDouble(ClaimItem::getTotal).sum();

        HealthCareClaim claim = new HealthCareClaim();
        claim.setOrganizationId(record.getOrganizationId());
        claim.setPatientId(record.getPatientId());
        
        String patientName = null;
        if (record.getPatientName() != null) {
            try {
                patientName = phiCryptoService.decrypt(record.getPatientName());
            } catch (Exception e) {
                patientName = record.getPatientName(); // fallback if not encrypted
            }
        }
        if (patientName == null || patientName.isBlank()) {
            patientName = record.getPatientId();
        }
        claim.setPatientName(patientName);

        String patientPhone = null;
        if (record.getPatientPhone() != null) {
            try {
                patientPhone = phiCryptoService.decrypt(record.getPatientPhone());
            } catch (Exception e) {
                patientPhone = record.getPatientPhone(); // fallback if not encrypted
            }
        }
        claim.setPatientPhone(patientPhone);

        claim.setPatientCareRecordId(recordId);
        claim.setClaimNumber(generateClaimNumber());
        claim.setItems(items);
        claim.setTotalAmount(totalAmount);

        resolvePayer(claim, coverage);
        claim.setEstimatedCoverageAmount(estimateCoverage(claim, coverage));

        // ── PRODUCTION: Provider Billing Number ────────────────────────────
        // Use the organization's registered licenseNumber as the billing ID.
        // This is the standard approach in NWT/Canadian EMS billing — the
        // provider billing number is tied to the licensed organization, not
        // the individual paramedic.
        String providerBillingNumber = null;
        if (record.getOrganizationId() != null) {
            providerBillingNumber = organizationRepository
                    .findById(record.getOrganizationId())
                    .map(Organization::getLicenseNumber)
                    .filter(ln -> ln != null && !ln.isBlank())
                    .orElse(null);
        }
        claim.setProviderBillingNumber(providerBillingNumber);

        // ── PRODUCTION: ICD-10 Diagnosis Code ──────────────────────────────
        // Priority: structured icd10Code → primaryImpression text → null
        // DRAFT claims with null icdCode must be reviewed by billing clerk.
        String icdCode = null;
        if (record.getIcd10Code() != null && !record.getIcd10Code().isBlank()) {
            icdCode = record.getIcd10Code();
        } else if (record.getPrimaryImpression() != null && !record.getPrimaryImpression().isBlank()) {
            // If no structured code, store the primary impression text as a
            // clinical hint for the billing clerk to assign the correct code.
            icdCode = record.getPrimaryImpression();
        }
        claim.setIcdCode(icdCode);

        // ── PRODUCTION: Destination Facility Code ──────────────────────────
        // Priority: structured transport.destinationFacilityId → transportDestination
        // text fuzzy-matched against Hospital registry → raw text stored → null.
        // Null means clerk must select facility before submission.
        String facilityCode = null;
        String destFacility = null;
        if (record.getTransport() != null && record.getTransport().getDestinationFacilityId() != null
                && !record.getTransport().getDestinationFacilityId().isBlank()) {
            destFacility = record.getTransport().getDestinationFacilityId();
        } else if (record.getTransportDestination() != null && !record.getTransportDestination().isBlank()) {
            destFacility = record.getTransportDestination();
        }

        if (destFacility != null) {
            if (destFacility.startsWith("enc::")) {
                try {
                    destFacility = phiCryptoService.decrypt(destFacility);
                } catch (Exception e) {
                    log.error("Failed to decrypt destination facility: " + destFacility, e);
                }
            }
            final String searchVal = destFacility;
            // Try exact ID match first
            Optional<Hospital> matchedHospital = hospitalRepository.findById(searchVal);
            if (matchedHospital.isEmpty()) {
                // Fall back to fuzzy name match against known NWT hospitals
                matchedHospital = hospitalRepository.findAll().stream()
                        .filter(h -> h.getName().toLowerCase().contains(searchVal.toLowerCase())
                                  || searchVal.toLowerCase().contains(h.getName().toLowerCase()))
                        .findFirst();
            }
            facilityCode = matchedHospital
                    .map(Hospital::getId)
                    .orElse(searchVal); // Store raw text if no match — clerk can correct
        }
        claim.setFacilityCode(facilityCode);

        claim.setStatus("DRAFT");
        claim.setCreatedAt(LocalDateTime.now());
        claim.setUpdatedAt(LocalDateTime.now());

        HealthCareClaim saved = claimRepository.save(claim);
        log.info("Auto-generated DRAFT claim {} for ePCR record {}", saved.getClaimNumber(), recordId);
        return saved;
    }

    // -----------------------------------------------------------------
    // Builds claim line items by matching ePCR procedures/incident type
    // against the BillingServiceCode master registry.
    // -----------------------------------------------------------------
    private List<ClaimItem> buildClaimItems(PatientCareRecord record) {
        List<ClaimItem> items = new ArrayList<>();

        // 1. Always bill the base transport/incident service if one matches
        matchServiceCode(record.getIncidentType()).ifPresent(code ->
                items.add(toClaimItem(code, 1)));

        // 2. Bill each performed procedure that has a matching service code
        if (record.getProceduresPerformed() != null) {
            for (String procedureName : record.getProceduresPerformed()) {
                matchServiceCode(procedureName).ifPresent(code ->
                        items.add(toClaimItem(code, 1)));
            }
        }


        if (items.isEmpty()) {
            log.warn("No billing service codes matched for record {} - claim will have zero items. "
                    + "Check BillingServiceCode.matchKeyword coverage.", record.getId());
        }

        return items;
    }

    private Optional<BillingServiceCode> matchServiceCode(String freeText) {
        if (freeText == null || freeText.isBlank()) {
            return Optional.empty();
        }
        String needle = freeText.toLowerCase();
        return serviceCodeRepository.findByActiveTrue().stream()
                .filter(sc -> sc.getMatchKeyword() != null
                        && needle.contains(sc.getMatchKeyword().toLowerCase()))
                .findFirst();
    }

    private ClaimItem toClaimItem(BillingServiceCode code, int quantity) {
        double total = code.getRate() * quantity;
        return new ClaimItem(code.getCode(), code.getDescription(), quantity, code.getRate(), total);
    }

    // -----------------------------------------------------------------
    // Payer resolution: NWT resident vs reciprocal province vs NIHB vs self-pay
    // -----------------------------------------------------------------
    private void resolvePayer(HealthCareClaim claim, HealthCareCoverage coverage) {
        if (coverage == null) {
            claim.setPayerId("SELF_PAY");
            claim.setPayerDetails("No coverage record on file");
            return;
        }

        claim.setPayerId(coverage.getPayerId()); // NWT_GOVT, NIHB, SELF_PAY, HOME_PROVINCE

        try {
            if ("HOME_PROVINCE".equals(coverage.getPayerId())) {
                String val = coverage.getHomeJurisdictionHealthCardNumber();
                claim.setPayerDetails(val != null && !val.isBlank() ? phiCryptoService.decrypt(val) : null);
            } else if ("NIHB".equals(coverage.getPayerId())) {
                String val = coverage.getNihbClientId();
                claim.setPayerDetails(val != null && !val.isBlank() ? phiCryptoService.decrypt(val) : null);
            } else if ("NWT_GOVT".equals(coverage.getPayerId())) {
                String val = coverage.getNwtPlanNumber();
                claim.setPayerDetails(val != null && !val.isBlank() ? phiCryptoService.decrypt(val) : null);
            } else {
                claim.setPayerDetails("SELF_PAY");
            }
        } catch (Exception e) {
            log.error("Failed to decrypt coverage details for patient: " + claim.getPatientId(), e);
            // fallback to raw value
            if ("HOME_PROVINCE".equals(coverage.getPayerId())) {
                claim.setPayerDetails(coverage.getHomeJurisdictionHealthCardNumber());
            } else if ("NIHB".equals(coverage.getPayerId())) {
                claim.setPayerDetails(coverage.getNihbClientId());
            } else if ("NWT_GOVT".equals(coverage.getPayerId())) {
                claim.setPayerDetails(coverage.getNwtPlanNumber());
            } else {
                claim.setPayerDetails("SELF_PAY");
            }
        }
    }

    private double estimateCoverage(HealthCareClaim claim, HealthCareCoverage coverage) {
        if (coverage == null || "SELF_PAY".equals(claim.getPayerId())) {
            return 0.0;
        }
        // NWT residents and NIHB are typically 100% covered for eligible services.
        // Reciprocal billing may differ by agreement - adjust as needed.
        return claim.getTotalAmount();
    }

    private String generateClaimNumber() {
        try {
            String orgId = TenantContext.currentOrganizationId();
            org.springframework.data.mongodb.core.query.Query query =
                    new org.springframework.data.mongodb.core.query.Query(
                            org.springframework.data.mongodb.core.query.Criteria.where("_id").is("claim_seq_" + (orgId != null ? orgId : "global")));
            org.springframework.data.mongodb.core.query.Update update =
                    new org.springframework.data.mongodb.core.query.Update().inc("seq", 1);
            org.springframework.data.mongodb.core.FindAndModifyOptions options =
                    org.springframework.data.mongodb.core.FindAndModifyOptions.options().upsert(true).returnNew(true);

            org.bson.Document doc = mongoTemplate.findAndModify(query, update, options, org.bson.Document.class, "counters");
            long seq = (doc != null && doc.get("seq") != null) ? ((Number) doc.get("seq")).longValue() : 100001L;
            return "CLM-" + LocalDateTime.now().getYear() + "-" + String.format("%06d", seq);
        } catch (Exception ex) {
            log.warn("Failed to generate sequence counter from MongoDB in BillingClaimsService, fallback to timestamp suffix: {}", ex.getMessage());
            return "CLM-" + LocalDateTime.now().getYear() + "-" + String.format("%06d", System.currentTimeMillis() % 1000000);
        }
    }

    // -----------------------------------------------------------------
    // STEP 2: VALIDATION — call before allowing DRAFT -> SUBMITTED
    // Controller-facing: always pass orgId from TenantContext.
    // -----------------------------------------------------------------
    public void validateClaim(String claimId, String orgId) {
        HealthCareClaim claim = claimRepository.findByIdAndOrganizationId(claimId, orgId)
                .orElseThrow(() -> new IllegalArgumentException("Claim not found or access denied: " + claimId));
        validateClaimInternal(claim);
    }

    // Internal overload used by generateSubmissionBatch() — claims are already
    // org-scoped by findByIdInAndOrganizationId(), so no second org lookup needed.
    private void validateClaim(String claimId) {
        HealthCareClaim claim = claimRepository.findById(claimId)
                .orElseThrow(() -> new IllegalArgumentException("Claim not found: " + claimId));
        validateClaimInternal(claim);
    }

    private void validateClaimInternal(HealthCareClaim claim) {
        if (claim.getItems() == null || claim.getItems().isEmpty()) {
            throw new IllegalStateException("Claim " + claim.getClaimNumber() + " has no billable items");
        }

        boolean formatOk = switch (claim.getPayerId()) {
            case "NWT_GOVT" -> claim.getPayerDetails() != null
                    && NWT_PLAN_PATTERN.matcher(claim.getPayerDetails()).matches();
            case "HOME_PROVINCE" -> claim.getPayerDetails() != null
                    && RECIPROCAL_CODE_PATTERN.matcher(claim.getPayerDetails()).matches();
            case "NIHB" -> claim.getPayerDetails() != null && !claim.getPayerDetails().isBlank();
            default -> true; // SELF_PAY needs no coverage-number validation
        };

        if (!formatOk) {
            claim.setStatus("REJECTED");
            claim.setRejectionReason("Coverage identifier failed format validation for payer " + claim.getPayerId());
            claimRepository.save(claim);
            throw new IllegalStateException(claim.getRejectionReason());
        }

        claim.setStatus("VALIDATED");
        claim.setUpdatedAt(LocalDateTime.now());
        claimRepository.save(claim);
    }

    // -----------------------------------------------------------------
    // STEP 3: SUBMISSION — batch selected DRAFT/VALIDATED claims into
    // one text/XML submission file for a payer.
    // -----------------------------------------------------------------
    public String generateSubmissionBatch(List<String> claimIds) {
        // Org-scoped lookup — prevents cross-tenant IDOR (Org A user cannot include Org B claim IDs)
        String orgId = TenantContext.currentOrganizationId();
        List<HealthCareClaim> rawClaims = claimRepository.findByIdInAndOrganizationId(claimIds, orgId);
        List<HealthCareClaim> claims = rawClaims.stream()
                .filter(c -> !"PAID".equalsIgnoreCase(c.getStatus()) && !"VOID".equalsIgnoreCase(c.getStatus()))
                .collect(Collectors.toList());

        if (claims.isEmpty()) {
            throw new IllegalArgumentException("No eligible claims found for supplied ids (settled/paid claims excluded)");
        }

        String batchId = "BATCH-" + System.currentTimeMillis();
        StringBuilder xml = new StringBuilder();
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        xml.append("<ClaimBatch batchId=\"").append(batchId).append("\">\n");

        for (HealthCareClaim claim : claims) {
            validateClaim(claim.getId()); // re-validate right before submission

            xml.append("  <Claim number=\"").append(xmlEscape(claim.getClaimNumber()))
               .append("\" payer=\"").append(xmlEscape(claim.getPayerId()))
               .append("\" payerDetails=\"").append(xmlEscape(claim.getPayerDetails()))
               .append("\" patientName=\"").append(xmlEscape(claim.getPatientName()))
               .append("\" patientPhone=\"").append(xmlEscape(claim.getPatientPhone()))
               .append("\">\n");
            for (ClaimItem item : claim.getItems()) {
                xml.append("    <Item code=\"").append(xmlEscape(item.getServiceCode()))
                   .append("\" qty=\"").append(item.getQuantity())
                   .append("\" unitPrice=\"").append(item.getUnitPrice())
                   .append("\" total=\"").append(item.getTotal())
                   .append("\"/>\n");
            }
            xml.append("    <TotalAmount>").append(claim.getTotalAmount()).append("</TotalAmount>\n");
            xml.append("  </Claim>\n");

            claim.setBatchId(batchId);
            claim.setStatus("SUBMITTED");
            claim.setSubmittedAt(LocalDateTime.now());
            claim.setUpdatedAt(LocalDateTime.now());

            sendClaimSubmissionEmail(claim);
        }
        xml.append("</ClaimBatch>\n");

        claimRepository.saveAll(claims);

        log.info("Generated submission batch {} with {} claims", batchId, claims.size());
        return batchId;
    }

    private void sendClaimSubmissionEmail(HealthCareClaim claim) {
        if (claim == null || emailService == null) return;
        try {
            String targetEmail = null;
            String patientName = claim.getPatientName() != null ? claim.getPatientName() : "Valued Patient";

            if (claim.getPatientId() != null && patientRepository != null) {
                var pOpt = patientRepository.findByPatientId(claim.getPatientId())
                        .or(() -> patientRepository.findById(claim.getPatientId()));
                if (pOpt.isPresent()) {
                    if (pOpt.get().getEmail() != null && !pOpt.get().getEmail().isBlank()) {
                        targetEmail = pOpt.get().getEmail();
                    }
                    if (pOpt.get().getPatientId() != null && (patientName.equalsIgnoreCase("Valued Patient") || patientName.isBlank())) {
                        patientName = pOpt.get().getPatientId();
                    }
                }
            }

            // PHI SECURITY: Do NOT fall back to payerDetails as email recipient.
            // payerDetails may hold insurance plan/coverage numbers — sending itemized
            // PHI there is a potential HIPAA violation and incorrect recipient risk.

            if (targetEmail != null && !targetEmail.isBlank()) {
                double amount = claim.getTotalAmount() != null ? claim.getTotalAmount() : 0.0;
                String subject = "Official Medical Claim Bill & Payment Notice: #" + claim.getClaimNumber() + " - Smart-eHR";
                
                // Build Itemized HTML Table for HealthCareClaim items
                StringBuilder itemsHtml = new StringBuilder();
                itemsHtml.append("<table style='width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px;'>")
                         .append("<thead style='background-color: #f1f5f9; color: #334155;'>")
                         .append("<tr>")
                         .append("<th style='padding: 10px; border: 1px solid #e2e8f0; text-align: left;'>Service Code</th>")
                         .append("<th style='padding: 10px; border: 1px solid #e2e8f0; text-align: left;'>Procedure Description</th>")
                         .append("<th style='padding: 10px; border: 1px solid #e2e8f0; text-align: center;'>Qty</th>")
                         .append("<th style='padding: 10px; border: 1px solid #e2e8f0; text-align: right;'>Unit Rate (₹)</th>")
                         .append("<th style='padding: 10px; border: 1px solid #e2e8f0; text-align: right;'>Total (₹)</th>")
                         .append("</tr></thead><tbody>");

                boolean hasItems = false;
                if (claim.getItems() != null && !claim.getItems().isEmpty()) {
                    for (ClaimItem item : claim.getItems()) {
                        hasItems = true;
                        double unitPrice = item.getUnitPrice() != null ? item.getUnitPrice() : 0.0;
                        double lineTotal = item.getTotal() != null ? item.getTotal() : (unitPrice * (item.getQuantity() != null ? item.getQuantity() : 1));
                        itemsHtml.append("<tr>")
                                 .append("<td style='padding: 10px; border: 1px solid #e2e8f0; font-family: monospace; font-weight: bold; color: #1e293b;'>").append(item.getServiceCode() != null ? item.getServiceCode() : "SVC").append("</td>")
                                 .append("<td style='padding: 10px; border: 1px solid #e2e8f0; color: #334155;'>").append(item.getDescription() != null ? item.getDescription() : "Medical Care Service").append("</td>")
                                 .append("<td style='padding: 10px; border: 1px solid #e2e8f0; text-align: center;'>").append(item.getQuantity() != null ? item.getQuantity() : 1).append("</td>")
                                 .append("<td style='padding: 10px; border: 1px solid #e2e8f0; text-align: right;'>₹").append(String.format("%.2f", unitPrice)).append("</td>")
                                 .append("<td style='padding: 10px; border: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #0f172a;'>₹").append(String.format("%.2f", lineTotal)).append("</td>")
                                 .append("</tr>");
                    }
                }

                if (!hasItems) {
                    itemsHtml.append("<tr><td colspan='5' style='padding: 12px; border: 1px solid #e2e8f0; text-align: center; color: #64748b;'>Standard Emergency Care & Medical Service Billed</td></tr>");
                }
                itemsHtml.append("</tbody></table>");

                String payerLabel = claim.getPayerId() != null ? claim.getPayerId() : "Self-Pay Carrier";
                String safePatientName = HtmlUtils.htmlEscape(patientName);
                String body = "<div style='font-family: Arial, sans-serif; padding: 28px; color: #1f2937; max-width: 650px; border: 1px solid #cbd5e1; border-radius: 12px; background-color: #ffffff;'>" +
                        "<div style='border-bottom: 2px solid #1a3c8f; padding-bottom: 16px; margin-bottom: 20px;'>" +
                        "<h2 style='color: #1a3c8f; margin: 0; font-size: 22px;'>Smart-eHR Billing & Claims Portal</h2>" +
                        "<p style='margin: 4px 0 0 0; color: #64748b; font-size: 13px;'>GNWT Dept of Health & Social Services / Batch Dispatcher</p>" +
                        "</div>" +
                        "<p style='font-size: 15px;'>Dear <strong>" + safePatientName + "</strong>,</p>" +
                        "<p style='font-size: 14px; color: #334155;'>Your medical billing claim <strong>#" + claim.getClaimNumber() + "</strong> has been batched and submitted to <strong>" + HtmlUtils.htmlEscape(payerLabel) + "</strong> for payment processing.</p>" +
                        "<h3 style='color: #0f172a; font-size: 16px; margin-top: 24px; margin-bottom: 8px;'>Itemized Medical Charges Breakdown</h3>" +
                        itemsHtml.toString() +
                        "<div style='background-color: #f8fafc; padding: 18px; border-radius: 10px; border-left: 5px solid #1a3c8f; margin: 24px 0; text-align: right;'>" +
                        "<p style='margin: 0; font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;'>Total Claim Amount Billed:</p>" +
                        "<p style='margin: 6px 0 0 0; font-size: 28px; font-weight: 800; color: #0f172a;'>₹" + String.format("%.2f", amount) + " INR</p>" +
                        "</div>" +
                        "<p style='font-size: 14px; color: #475569;'>You can monitor batch transmission logs or view your invoice balance anytime via the Patient Portal.</p>" +
                        "<div style='text-align: center; margin-top: 28px;'><a href='" + frontendBaseUrl + "/patient-portal' style='background-color: #1a3c8f; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);'>Log In & Pay Bill Online</a></div>" +
                        "</div>";

                emailService.sendEmail(targetEmail, subject, body);
                log.info("Itemized submission notice email sent to {} for claim {}", targetEmail, claim.getClaimNumber());
            } else {
                log.info("⚠️ [NOTICE] No registered email address on file for patient {}. Skipping email dispatch.", claim.getPatientId());
            }
        } catch (Exception ex) {
            log.warn("Batch submission email skipped for claim {}: {}", claim.getClaimNumber(), ex.getMessage());
        }
    }

    private String nullSafe(String value) {
        return value == null ? "" : value;
    }

    // Reconstruct XML batch on-the-fly from database claims (org-scoped)
    public String getBatchXml(String batchId) {
        String orgId = TenantContext.currentOrganizationId();
        return getBatchXml(batchId, orgId);
    }

    public String getBatchXml(String batchId, String orgId) {
        List<HealthCareClaim> claims = claimRepository.findByBatchIdAndOrganizationId(batchId, orgId);

        if (claims.isEmpty()) {
            throw new IllegalArgumentException("No claims found for batch: " + batchId + " in org " + orgId);
        }

        StringBuilder xml = new StringBuilder();
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        xml.append("<ClaimBatch batchId=\"").append(xmlEscape(batchId)).append("\">\n");

        for (HealthCareClaim claim : claims) {
            xml.append("  <Claim number=\"").append(xmlEscape(claim.getClaimNumber()))
               .append("\" payer=\"").append(xmlEscape(claim.getPayerId()))
               .append("\" payerDetails=\"").append(xmlEscape(claim.getPayerDetails()))
               .append("\" patientName=\"").append(xmlEscape(claim.getPatientName()))
               .append("\" patientPhone=\"").append(xmlEscape(claim.getPatientPhone()))
               .append("\">\n");
            if (claim.getItems() != null) {
                for (ClaimItem item : claim.getItems()) {
                    xml.append("    <Item code=\"").append(xmlEscape(item.getServiceCode()))
                       .append("\" qty=\"").append(item.getQuantity())
                       .append("\" unitPrice=\"").append(item.getUnitPrice())
                       .append("\" total=\"").append(item.getTotal())
                       .append("\"/>\n");
                }
            }
            xml.append("    <TotalAmount>").append(claim.getTotalAmount() != null ? claim.getTotalAmount() : 0.0).append("</TotalAmount>\n");
            xml.append("  </Claim>\n");
        }
        xml.append("</ClaimBatch>\n");
        return xml.toString();
    }
}
