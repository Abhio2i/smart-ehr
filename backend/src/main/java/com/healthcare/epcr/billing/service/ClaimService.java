package com.healthcare.epcr.billing.service;

import com.healthcare.epcr.billing.model.HealthCareClaim;
import com.healthcare.epcr.billing.model.ClaimItem;
import com.healthcare.epcr.common.exception.ResourceNotFoundException;
import com.healthcare.epcr.billing.dto.CreateClaimRequest;
import com.healthcare.epcr.billing.exception.InvalidClaimStateException;
import com.healthcare.epcr.billing.model.Claim;
import com.healthcare.epcr.billing.model.ClaimStatus;
import com.healthcare.epcr.billing.repository.ClaimRepository;
import com.healthcare.epcr.billing.repository.HealthCareClaimRepository;
import com.healthcare.epcr.billing.security.TenantContext;
import com.healthcare.epcr.notification.service.EmailService;
import com.healthcare.epcr.patient.repository.PatientRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.HtmlUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;

@Service
@RequiredArgsConstructor
@Slf4j
public class ClaimService {

    @Value("${app.frontend.base-url:http://localhost:5173/epcr}")
    private String frontendBaseUrl;

    private final ClaimRepository claimRepository;
    private final MongoTemplate mongoTemplate;

    @Autowired(required = false)
    private EmailService emailService;

    @Autowired(required = false)
    private PatientRepository patientRepository;

    @Autowired(required = false)
    private HealthCareClaimRepository healthCareClaimRepository;

    @Autowired(required = false)
    private PdfReceiptGeneratorService pdfReceiptGeneratorService;

    @Autowired(required = false)
    private com.healthcare.epcr.billing.repository.DoctorPaymentAccountRepository doctorPaymentAccountRepository;

    @Autowired(required = false)
    private com.healthcare.epcr.user.repository.UserRepository userRepository;

    @Autowired(required = false)
    private RazorpayPayoutService razorpayPayoutService;

    @Autowired(required = false)
    private com.healthcare.epcr.billing.repository.OrgPaymentGatewayConfigRepository orgPaymentGatewayConfigRepository;

    // legal state transitions — anything not listed here is rejected
    private static final Map<ClaimStatus, Set<ClaimStatus>> TRANSITIONS = new EnumMap<>(ClaimStatus.class);
    static {
        TRANSITIONS.put(ClaimStatus.DRAFT, EnumSet.of(ClaimStatus.READY, ClaimStatus.SUBMITTED, ClaimStatus.PAID, ClaimStatus.VOID));
        TRANSITIONS.put(ClaimStatus.READY, EnumSet.of(ClaimStatus.SUBMITTED, ClaimStatus.PAID, ClaimStatus.VOID));
        TRANSITIONS.put(ClaimStatus.SUBMITTED, EnumSet.of(ClaimStatus.ACCEPTED, ClaimStatus.DENIED, ClaimStatus.PAID));
        TRANSITIONS.put(ClaimStatus.ACCEPTED, EnumSet.of(ClaimStatus.PARTIALLY_PAID, ClaimStatus.PAID));
        TRANSITIONS.put(ClaimStatus.PARTIALLY_PAID, EnumSet.of(ClaimStatus.PAID));
        TRANSITIONS.put(ClaimStatus.DENIED, EnumSet.of(ClaimStatus.APPEALED, ClaimStatus.VOID));
        TRANSITIONS.put(ClaimStatus.APPEALED, EnumSet.of(ClaimStatus.SUBMITTED, ClaimStatus.DENIED, ClaimStatus.PAID));
    }

    // ---------- READ (org-scoped) ----------

    public Claim getClaim(String claimId) {
        String orgId = TenantContext.currentOrganizationId();
        Claim claim = claimRepository.findByIdAndOrganizationId(claimId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Claim not found"));

        if (TenantContext.isPatientToken()) {
            String patientId = TenantContext.currentPatientId();
            if (patientId != null && !patientId.equals(claim.getPatientId())) {
                throw new AccessDeniedException("Access denied: Not your record");
            }
        }
        recalculateDynamicTotals(claim);
        return claim;
    }

    public Page<Claim> listClaims(ClaimStatus status, Pageable pageable) {
        return listClaims(status, null, pageable);
    }

    public Page<Claim> listClaims(ClaimStatus status, String organizationIdParam, Pageable pageable) {
        // IDOR guard: patient tokens must NEVER see all org claims
        if (TenantContext.isPatientToken()) {
            return listForPatient(null, pageable);
        }

        boolean isAdmin = TenantContext.hasRole("ADMIN");
        String userOrgId = TenantContext.currentOrganizationId();

        // ONLY ADMIN can explicitly specify another tenant organizationIdParam.
        // All non-admins (MANAGER, PHYSICIAN, etc.) are strictly forced to their own orgId (userOrgId).
        String effectiveOrgId = (isAdmin && organizationIdParam != null && !organizationIdParam.isBlank())
                ? organizationIdParam
                : userOrgId;

        log.debug("listClaims: effectiveOrgId={}, userOrgId={}, status={}", effectiveOrgId, userOrgId, status);

        // Fetch claims using DB-level query (paginated / org-scoped)
        List<Claim> baseList = new java.util.ArrayList<>();

        if (isAdmin && (organizationIdParam == null || organizationIdParam.isBlank())) {
            // Global view for Platform Admin across all tenants
            if (status != null) {
                baseList.addAll(claimRepository.findByStatus(status, pageable).getContent());
            } else {
                baseList.addAll(claimRepository.findAll(pageable).getContent());
            }
        } else if (effectiveOrgId != null && !effectiveOrgId.isBlank()) {
            // Strict DB query-level org filter (NO in-memory streaming of entire DB)
            if (status != null) {
                baseList.addAll(claimRepository.findByOrganizationIdAndStatus(effectiveOrgId, status, pageable).getContent());
            } else {
                baseList.addAll(claimRepository.findByOrganizationId(effectiveOrgId, pageable).getContent());
            }
        }

        // Backfill from HealthCareClaimRepository if missing from ClaimRepository
        if (healthCareClaimRepository != null && effectiveOrgId != null && !effectiveOrgId.isBlank()) {
            List<HealthCareClaim> hcList;
            if (status != null) {
                hcList = healthCareClaimRepository.findByOrganizationIdAndStatus(effectiveOrgId, status.name());
            } else {
                hcList = healthCareClaimRepository.findByOrganizationId(effectiveOrgId, PageRequest.of(0, 100)).getContent();
            }

            hcList.forEach(hc -> {
                boolean exists = baseList.stream().anyMatch(c ->
                    (hc.getId() != null && hc.getId().equals(c.getId())) ||
                    (hc.getClaimNumber() != null && hc.getClaimNumber().equals(c.getClaimNumber())));
                if (!exists) {
                    Claim c = new Claim();
                    c.setId(hc.getId());
                    c.setOrganizationId(hc.getOrganizationId());
                    c.setPatientId(hc.getPatientId());
                    c.setPatientName(hc.getPatientName());
                    c.setEpcrRecordId(hc.getPatientCareRecordId());
                    c.setClaimNumber(hc.getClaimNumber());
                    c.setPayerId(hc.getPayerId());
                    double amt = hc.getTotalAmount() != null ? hc.getTotalAmount() : 1500.0;
                    c.setTotalCharged(BigDecimal.valueOf(amt));
                    c.setPatientResponsibility(BigDecimal.valueOf(amt));
                    try {
                        c.setStatus(ClaimStatus.valueOf(hc.getStatus()));
                    } catch (Exception ex) {
                        c.setStatus(ClaimStatus.DRAFT);
                    }
                    baseList.add(c);
                }
            });
        }

        baseList.forEach(this::recalculateDynamicTotals);
        return new org.springframework.data.domain.PageImpl<>(baseList, pageable, baseList.size());
    }

    public Page<Claim> listForPatient(String patientId, Pageable pageable) {
        String orgId = TenantContext.currentOrganizationId();
        String scopedPatientId = TenantContext.isPatientToken() ? TenantContext.currentPatientId() : patientId;

        if (TenantContext.isPatientToken() && (scopedPatientId == null || scopedPatientId.isBlank())) {
            return Page.empty(pageable);
        }

        Page<Claim> page;
        if (scopedPatientId == null || scopedPatientId.isBlank()) {
            page = claimRepository.findByOrganizationId(orgId, pageable);
        } else {
            page = claimRepository.findByOrganizationIdAndPatientId(orgId, scopedPatientId, pageable);
        }
        page.forEach(this::recalculateDynamicTotals);
        return page;
    }

    private void recalculateDynamicTotals(Claim claim) {
        if (claim == null) return;
        BigDecimal calculated = BigDecimal.ZERO;
        if (claim.getLineItems() != null && !claim.getLineItems().isEmpty()) {
            calculated = claim.getLineItems().stream()
                    .map(i -> {
                        if (i.getLineTotal() != null && i.getLineTotal().compareTo(BigDecimal.ZERO) > 0) {
                            return i.getLineTotal();
                        }
                        if (i.getUnitCharge() != null) {
                            int q = i.getQuantity() > 0 ? i.getQuantity() : 1;
                            return i.getUnitCharge().multiply(BigDecimal.valueOf(q));
                        }
                        return BigDecimal.ZERO;
                    })
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
        }

        if (calculated.compareTo(BigDecimal.ZERO) > 0) {
            claim.setTotalCharged(calculated);
            claim.setPatientResponsibility(calculated);
        }
        // If no line items, leave the existing totalCharged as-is (could be 0 for a new draft)
    }

    // ---------- CREATE ----------

    @Transactional
    public Claim createClaim(CreateClaimRequest request, String idempotencyKey) {
        String orgId = TenantContext.currentOrganizationId();

        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            var existing = claimRepository.findByOrganizationIdAndIdempotencyKey(orgId, idempotencyKey);
            if (existing.isPresent()) {
                return existing.get(); // safe retry — return the same claim instead of creating a duplicate
            }
        }

        if (request.getEpcrRecordId() != null) {
            var existingForRecord = claimRepository.findByOrganizationIdAndEpcrRecordId(orgId, request.getEpcrRecordId());
            if (existingForRecord.isPresent()) {
                throw new InvalidClaimStateException("A claim already exists for this ePCR record");
            }
        }

        Claim claim = new Claim();
        claim.setOrganizationId(orgId); // server-derived, ignore anything client sent
        claim.setPatientId(request.getPatientId());
        claim.setPatientName(request.getPatientName());
        claim.setDoctorUserId(request.getDoctorUserId());
        claim.setDoctorName(request.getDoctorName());
        claim.setEpcrRecordId(request.getEpcrRecordId());
        claim.setPayerType(request.getPayerType());
        claim.setPayerId(request.getPayerId());
        claim.setStatus(ClaimStatus.DRAFT);
        claim.setClaimNumber(generateClaimNumber(orgId));
        claim.setIdempotencyKey(idempotencyKey);
        claim.setCreatedByUserId(TenantContext.currentUserId());

        // Map incoming line items from the Bill modal
        if (request.getItems() != null && !request.getItems().isEmpty()) {
            List<com.healthcare.epcr.billing.model.ClaimLineItem> lineItems = new java.util.ArrayList<>();
            BigDecimal total = BigDecimal.ZERO;
            for (CreateClaimRequest.LineItemRequest item : request.getItems()) {
                com.healthcare.epcr.billing.model.ClaimLineItem li = new com.healthcare.epcr.billing.model.ClaimLineItem();
                li.setCptOrHcpcsCode(item.getServiceCode());
                li.setDescription(item.getDescription());
                li.setQuantity(item.getQuantity() > 0 ? item.getQuantity() : 1);
                BigDecimal unitCharge = BigDecimal.valueOf(item.getUnitPrice());
                li.setUnitCharge(unitCharge);
                BigDecimal lineTotal = unitCharge.multiply(BigDecimal.valueOf(li.getQuantity()));
                li.setLineTotal(lineTotal);
                try { li.setSourceType(com.healthcare.epcr.billing.model.LineItemSourceType.valueOf(item.getSourceType())); } catch (Exception ignored) {}
                lineItems.add(li);
                total = total.add(lineTotal);
            }
            claim.setLineItems(lineItems);
            claim.setTotalCharged(total);
            claim.setPatientResponsibility(total);
        }

        Claim saved = claimRepository.save(claim);

        // Sync to HealthCareClaim collection
        if (healthCareClaimRepository != null) {
            com.healthcare.epcr.billing.model.HealthCareClaim hc = new com.healthcare.epcr.billing.model.HealthCareClaim();
            hc.setId(saved.getId());
            hc.setOrganizationId(orgId);
            hc.setPatientId(saved.getPatientId());
            hc.setPatientName(request.getPatientName());
            hc.setDoctorUserId(saved.getDoctorUserId());
            hc.setDoctorName(saved.getDoctorName());
            hc.setPatientCareRecordId(saved.getEpcrRecordId());
            hc.setClaimNumber(saved.getClaimNumber());
            hc.setPayerId(saved.getPayerId() != null ? saved.getPayerId() : "SELF_PAY");
            hc.setIcdCode(request.getIcdCode());
            hc.setFacilityCode(request.getFacilityCode());
            hc.setProviderBillingNumber(request.getProviderBillingNumber());
            double amt = saved.getTotalCharged() != null ? saved.getTotalCharged().doubleValue() : 0.0;
            hc.setTotalAmount(amt);
            hc.setStatus("DRAFT");
            hc.setCreatedAt(LocalDateTime.now());
            hc.setUpdatedAt(LocalDateTime.now());
            healthCareClaimRepository.save(hc);
        }

        return saved;
    }

    // ---------- STATE TRANSITIONS (atomic, race-condition safe) ----------

    @Transactional
    public Claim transitionStatus(String claimId, ClaimStatus targetStatus, String reasonOrCode) {
        String orgId = TenantContext.currentOrganizationId();
        Claim current = claimRepository.findByIdAndOrganizationId(claimId, orgId)
                .orElseGet(() -> claimRepository.findByOrganizationIdAndClaimNumber(orgId, claimId)
                        .orElseThrow(() -> new ResourceNotFoundException("Claim not found: " + claimId)));

        Set<ClaimStatus> allowed = TRANSITIONS.getOrDefault(current.getStatus(), EnumSet.noneOf(ClaimStatus.class));
        if (!allowed.contains(targetStatus)) {
            throw new InvalidClaimStateException(
                    "Cannot move claim from " + current.getStatus() + " to " + targetStatus);
        }

        // atomic conditional update — only succeeds if status still matches what we read
        Query query = new Query(Criteria.where("_id").is(claimId)
                .and("organizationId").is(orgId)
                .and("status").is(current.getStatus()));

        Update update = new Update()
                .set("status", targetStatus)
                .set("updatedAt", LocalDateTime.now());

        if (targetStatus == ClaimStatus.SUBMITTED) {
            update.set("submittedAt", LocalDateTime.now());
        }
        if (targetStatus == ClaimStatus.ACCEPTED || targetStatus == ClaimStatus.DENIED) {
            update.set("adjudicatedAt", LocalDateTime.now());
        }
        if (targetStatus == ClaimStatus.DENIED) {
            update.set("denialCode", reasonOrCode);
            update.set("appealDeadline", LocalDateTime.now().plusDays(30));
        }

        Claim updated = mongoTemplate.findAndModify(
                query, update,
                org.springframework.data.mongodb.core.FindAndModifyOptions.options().returnNew(true),
                Claim.class);

        if (updated == null) {
            throw new InvalidClaimStateException(
                    "Claim status changed concurrently — please refresh and retry");
        }
        return updated;
    }

    public Claim submit(String claimId) {
        Claim claim = transitionStatus(claimId, ClaimStatus.SUBMITTED, null);

        if (healthCareClaimRepository != null) {
            healthCareClaimRepository.findById(claimId).ifPresent(hc -> {
                hc.setStatus("SUBMITTED");
                hc.setSubmittedAt(LocalDateTime.now());
                healthCareClaimRepository.save(hc);
            });
            healthCareClaimRepository.findByClaimNumber(claimId).ifPresent(hc -> {
                hc.setStatus("SUBMITTED");
                hc.setSubmittedAt(LocalDateTime.now());
                healthCareClaimRepository.save(hc);
            });
        }

        // Send email notice to patient/payer with full itemized billing schedule
        try {
            if (claim != null && emailService != null) {
                String targetEmail = null;
                String patientName = "Valued Patient";

                if (claim.getPatientId() != null && patientRepository != null) {
                    var pOpt = patientRepository.findByPatientId(claim.getPatientId())
                            .or(() -> patientRepository.findById(claim.getPatientId()));
                    if (pOpt.isPresent()) {
                        if (pOpt.get().getEmail() != null && !pOpt.get().getEmail().isBlank()) {
                            targetEmail = pOpt.get().getEmail();
                        }
                        if (pOpt.get().getPatientId() != null) {
                            patientName = pOpt.get().getPatientId();
                        }
                    }
                }

                // Check HealthCareClaimRepository if patient name is missing
                com.healthcare.epcr.billing.model.HealthCareClaim linkedHcClaim = null;
                if (healthCareClaimRepository != null) {
                    var hcOpt = healthCareClaimRepository.findById(claimId)
                            .or(() -> healthCareClaimRepository.findByClaimNumber(claim.getClaimNumber()));
                    if (hcOpt.isPresent()) {
                        linkedHcClaim = hcOpt.get();
                        if (linkedHcClaim.getPatientName() != null && !linkedHcClaim.getPatientName().isBlank()) {
                            patientName = linkedHcClaim.getPatientName();
                        }
                    }
                }

                if (targetEmail != null && !targetEmail.isBlank()) {
                    double amount = claim.getTotalCharged() != null ? claim.getTotalCharged().doubleValue() : 0.0;
                    String safePatientName = HtmlUtils.htmlEscape(patientName);
                    String subject = "Official Medical Bill & Payment Notice: #" + claim.getClaimNumber() + " - Smart-eHR";

                    // Build Itemized HTML Table
                    StringBuilder itemsHtml = new StringBuilder();
                    itemsHtml.append("<table style='width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px;'>")
                             .append("<thead style='background-color: #f1f5f9; color: #334155;'>")
                             .append("<tr>")
                             .append("<th style='padding: 10px; border: 1px solid #e2e8f0; text-align: left;'>Code</th>")
                             .append("<th style='padding: 10px; border: 1px solid #e2e8f0; text-align: left;'>Service / Procedure</th>")
                             .append("<th style='padding: 10px; border: 1px solid #e2e8f0; text-align: center;'>Qty</th>")
                             .append("<th style='padding: 10px; border: 1px solid #e2e8f0; text-align: right;'>Unit Rate (₹)</th>")
                             .append("<th style='padding: 10px; border: 1px solid #e2e8f0; text-align: right;'>Total (₹)</th>")
                             .append("</tr></thead><tbody>");

                    boolean hasItems = false;
                    if (claim.getLineItems() != null && !claim.getLineItems().isEmpty()) {
                        for (var item : claim.getLineItems()) {
                            hasItems = true;
                            double unitPrice = item.getUnitCharge() != null ? item.getUnitCharge().doubleValue() : 0.0;
                            double lineTotal = item.getLineTotal() != null ? item.getLineTotal().doubleValue() : (unitPrice * item.getQuantity());
                            itemsHtml.append("<tr>")
                                     .append("<td style='padding: 10px; border: 1px solid #e2e8f0; font-family: monospace; font-weight: bold; color: #1e293b;'>").append(HtmlUtils.htmlEscape(item.getCptOrHcpcsCode() != null ? item.getCptOrHcpcsCode() : "PROC")).append("</td>")
                                     .append("<td style='padding: 10px; border: 1px solid #e2e8f0; color: #334155;'>").append(HtmlUtils.htmlEscape(item.getDescription() != null ? item.getDescription() : "Medical Procedure")).append("</td>")
                                     .append("<td style='padding: 10px; border: 1px solid #e2e8f0; text-align: center;'>").append(item.getQuantity()).append("</td>")
                                     .append("<td style='padding: 10px; border: 1px solid #e2e8f0; text-align: right;'>₹").append(String.format("%.2f", unitPrice)).append("</td>")
                                     .append("<td style='padding: 10px; border: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #0f172a;'>₹").append(String.format("%.2f", lineTotal)).append("</td>")
                                     .append("</tr>");
                        }
                    } else if (linkedHcClaim != null && linkedHcClaim.getItems() != null && !linkedHcClaim.getItems().isEmpty()) {
                        for (var item : linkedHcClaim.getItems()) {
                            hasItems = true;
                            double unitPrice = item.getUnitPrice() != null ? item.getUnitPrice() : 0.0;
                            double lineTotal = item.getTotal() != null ? item.getTotal() : (unitPrice * item.getQuantity());
                            itemsHtml.append("<tr>")
                                     .append("<td style='padding: 10px; border: 1px solid #e2e8f0; font-family: monospace; font-weight: bold; color: #1e293b;'>").append(HtmlUtils.htmlEscape(item.getServiceCode() != null ? item.getServiceCode() : "SVC")).append("</td>")
                                     .append("<td style='padding: 10px; border: 1px solid #e2e8f0; color: #334155;'>").append(HtmlUtils.htmlEscape(item.getDescription() != null ? item.getDescription() : "Medical Care Service")).append("</td>")
                                     .append("<td style='padding: 10px; border: 1px solid #e2e8f0; text-align: center;'>").append(item.getQuantity() != null ? item.getQuantity() : 1).append("</td>")
                                     .append("<td style='padding: 10px; border: 1px solid #e2e8f0; text-align: right;'>₹").append(String.format("%.2f", unitPrice)).append("</td>")
                                     .append("<td style='padding: 10px; border: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #0f172a;'>₹").append(String.format("%.2f", lineTotal)).append("</td>")
                                     .append("</tr>");
                        }
                    }

                    if (!hasItems) {
                        itemsHtml.append("<tr><td colspan='5' style='padding: 12px; border: 1px solid #e2e8f0; text-align: center; color: #64748b;'>Standard Care & Medical Service Billed</td></tr>");
                    }
                    itemsHtml.append("</tbody></table>");

                    String payerLabel = claim.getPayerType() != null ? claim.getPayerType().name() : "Self-Pay / Carrier";
                    String body = "<div style='font-family: Arial, sans-serif; padding: 28px; color: #1f2937; max-width: 650px; border: 1px solid #cbd5e1; border-radius: 12px; background-color: #ffffff;'>" +
                            "<div style='border-bottom: 2px solid #1a3c8f; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;'>" +
                            "<div><h2 style='color: #1a3c8f; margin: 0; font-size: 22px;'>Smart-eHR Medical Portal</h2><p style='margin: 4px 0 0 0; color: #64748b; font-size: 13px;'>GNWT Dept of Health & Social Services / Billing Division</p></div>" +
                            "</div>" +
                            "<p style='font-size: 15px;'>Dear <strong>" + safePatientName + "</strong>,</p>" +
                            "<p style='font-size: 14px; color: #334155;'>Your official medical claim bill <strong>#" + claim.getClaimNumber() + "</strong> has been submitted to <strong>" + HtmlUtils.htmlEscape(payerLabel) + "</strong> for payment and adjudication.</p>" +
                            "<h3 style='color: #0f172a; font-size: 16px; margin-top: 24px; margin-bottom: 8px;'>Itemized Billing Breakdown</h3>" +
                            itemsHtml.toString() +
                            "<div style='background-color: #f8fafc; padding: 18px; border-radius: 10px; border-left: 5px solid #1a3c8f; margin: 24px 0; text-align: right;'>" +
                            "<p style='margin: 0; font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;'>Total Amount Due / Billed:</p>" +
                            "<p style='margin: 6px 0 0 0; font-size: 28px; font-weight: 800; color: #0f172a;'>₹" + String.format("%.2f", amount) + " INR</p>" +
                            "</div>" +
                            "<p style='font-size: 14px; color: #475569;'>You can review itemized service charges, check insurance approval status, or settle outstanding balances online.</p>" +
                            "<div style='text-align: center; margin-top: 28px;'><a href='" + frontendBaseUrl + "/patient-portal' style='background-color: #1a3c8f; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);'>Log In & Pay Bill Online</a></div>" +
                            "</div>";

                    emailService.sendEmail(targetEmail, subject, body);
                    log.info("Itemized medical bill email dispatched to: {} for claim: {}", targetEmail, claim.getClaimNumber());
                } else {
                    log.info("⚠️ [NOTICE] No registered email address on file for patient {}. Skipping email dispatch.", claim.getPatientId());
                }
            }
        } catch (Exception ex) {
            log.warn("Invoice email dispatch error for claim {}: {}", claim.getClaimNumber(), ex.getMessage());
        }

        return claim;
    }

    public Claim deny(String claimId, String denialCode, String denialReason) {
        Claim claim = transitionStatus(claimId, ClaimStatus.DENIED, denialCode);
        claim.setDenialReason(denialReason);
        return claimRepository.save(claim);
    }

    public Claim appeal(String claimId) {
        return transitionStatus(claimId, ClaimStatus.APPEALED, null);
    }

    public Claim voidClaim(String claimId) {
        // Patient tokens cannot void any claim — admin/billing staff only
        if (TenantContext.isPatientToken()) {
            throw new AccessDeniedException("Patients are not authorized to void claims.");
        }
        String orgId = TenantContext.currentOrganizationId();
        Claim claim = claimRepository.findByIdAndOrganizationId(claimId, orgId)
                .orElseGet(() -> claimRepository.findByOrganizationIdAndClaimNumber(orgId, claimId).orElse(null));

        if (claim != null) {
            if (claim.getStatus() == ClaimStatus.PAID) {
                throw new InvalidClaimStateException("Cannot void a settled/paid claim #" + claim.getClaimNumber());
            }
            claimRepository.delete(claim);
            log.info("Claim {} deleted by user in org {}", claim.getClaimNumber(), orgId);
        }

        if (healthCareClaimRepository != null) {
            healthCareClaimRepository.findByIdAndOrganizationId(claimId, orgId).ifPresent(hc -> {
                if ("PAID".equalsIgnoreCase(hc.getStatus())) {
                    throw new InvalidClaimStateException("Cannot void a settled/paid claim");
                }
                healthCareClaimRepository.delete(hc);
            });
            healthCareClaimRepository.findByOrganizationIdAndClaimNumber(orgId, claimId).ifPresent(hc -> {
                if (!"PAID".equalsIgnoreCase(hc.getStatus())) {
                    healthCareClaimRepository.delete(hc);
                }
            });
        }

        return claim != null ? claim : new Claim();
    }

    @Transactional
    public Claim payClaim(String claimId, String paymentMethod, String transactionRef) {
        String orgId = TenantContext.currentOrganizationId();
        Claim claim = claimRepository.findByIdAndOrganizationId(claimId, orgId)
                .orElseGet(() -> claimRepository.findByOrganizationIdAndClaimNumber(orgId, claimId).orElse(null));

        if (claim == null) {
            throw new ResourceNotFoundException("Claim not found: " + claimId);
        }

        // DOUBLE PAYMENT GUARD: Reject if already PAID
        if (claim.getStatus() == ClaimStatus.PAID) {
            throw new InvalidClaimStateException(
                    "Claim #" + claim.getClaimNumber() + " has already been paid and settled.");
        }

        if (TenantContext.isPatientToken()) {
            String patientId = TenantContext.currentPatientId();
            if (patientId != null && !patientId.equals(claim.getPatientId())) {
                throw new AccessDeniedException("Access denied: You are only authorized to pay your own billing invoices.");
            }
        }
        recalculateDynamicTotals(claim);
        claim.setStatus(ClaimStatus.PAID);
        BigDecimal amt = (claim.getPatientResponsibility() != null && claim.getPatientResponsibility().compareTo(BigDecimal.ZERO) > 0)
                ? claim.getPatientResponsibility()
                : (claim.getTotalCharged() != null ? claim.getTotalCharged() : BigDecimal.ZERO);
        claim.setPatientResponsibility(amt);
        claim.setTotalPaid(amt);
        claim = claimRepository.save(claim);

        if (healthCareClaimRepository != null) {
            healthCareClaimRepository.findById(claimId).ifPresent(hc -> {
                hc.setStatus("PAID");
                healthCareClaimRepository.save(hc);
            });
            healthCareClaimRepository.findByClaimNumber(claimId).ifPresent(hc -> {
                hc.setStatus("PAID");
                healthCareClaimRepository.save(hc);
            });
        }

        // Dispatch official payment receipt email with itemized medical report to patient
        String finalRef = transactionRef != null ? transactionRef : ("TXN-" + System.currentTimeMillis());
        sendPaymentReceiptEmail(claim, paymentMethod != null ? paymentMethod : "RAZORPAY", finalRef);
        sendDoctorAgreedPaymentEmail(claim, finalRef);
        triggerDoctorAutoSplit(claim, finalRef);  // ← AUTO UPI SPLIT on patient payment

        return claim != null ? claim : new Claim();
    }

    // ---------- Webhook payment settlement (no TenantContext/JWT available) ----------

    /**
     * Settles a claim via Razorpay webhook callback.
     * Webhooks have NO JWT token so TenantContext.currentOrganizationId() returns null.
     * This method does a cross-org lookup by claim ID or HealthCare claim ID.
     */
    @Transactional
    public void payClaimViaWebhook(String claimId, String paymentId, String webhookOrgId) {
        if (claimId == null || claimId.isBlank()) return;

        // Multi-tier claim search by ID, claimNumber, or org+claimNumber
        Claim claim = claimRepository.findById(claimId).orElse(null);
        if (claim == null) {
            claim = claimRepository.findByClaimNumber(claimId).orElse(null);
        }
        if (claim == null && webhookOrgId != null && !webhookOrgId.isBlank()) {
            claim = claimRepository.findByOrganizationIdAndClaimNumber(webhookOrgId, claimId).orElse(null);
        }

        if (claim != null) {
            // SECURITY GUARD: If webhook URL target org ID is provided, verify it matches the claim's org ID
            if (webhookOrgId != null && !webhookOrgId.isBlank() && !webhookOrgId.equalsIgnoreCase(claim.getOrganizationId())) {
                log.warn("🚫 Webhook settlement REJECTED: Claim {} belongs to org {} but webhook was targeted at org {}",
                        claimId, claim.getOrganizationId(), webhookOrgId);
                return;
            }

            if (claim.getStatus() == ClaimStatus.PAID) {
                log.info("ℹ️ Claim {} already marked PAID — skipping duplicate webhook processing", claim.getClaimNumber());
                return;
            }

            recalculateDynamicTotals(claim);
            claim.setStatus(ClaimStatus.PAID);
            BigDecimal amt = (claim.getPatientResponsibility() != null && claim.getPatientResponsibility().compareTo(BigDecimal.ZERO) > 0)
                    ? claim.getPatientResponsibility()
                    : (claim.getTotalCharged() != null ? claim.getTotalCharged() : BigDecimal.ZERO);
            claim.setPatientResponsibility(amt);
            claim.setTotalPaid(amt);
            claim = claimRepository.save(claim);

            if (healthCareClaimRepository != null) {
                HealthCareClaim hc = healthCareClaimRepository.findById(claim.getId()).orElse(null);
                if (hc == null) {
                    hc = healthCareClaimRepository.findByClaimNumber(claim.getClaimNumber()).orElse(null);
                }
                if (hc != null) {
                    hc.setStatus("PAID");
                    healthCareClaimRepository.save(hc);
                }
            }

            log.info("🎉 SUCCESS: Claim {} (#{}) marked PAID via webhook. Sending emails & triggering payout split.",
                    claim.getId(), claim.getClaimNumber());

            sendPaymentReceiptEmail(claim, "RAZORPAY", paymentId);
            sendDoctorAgreedPaymentEmail(claim, paymentId);
            triggerDoctorAutoSplit(claim, paymentId);  // ← AUTO UPI SPLIT on webhook payment
        } else if (healthCareClaimRepository != null) {
            // Try HealthCareClaim by ID or claimNumber
            HealthCareClaim hc = healthCareClaimRepository.findById(claimId).orElse(null);
            if (hc == null) {
                hc = healthCareClaimRepository.findByClaimNumber(claimId).orElse(null);
            }

            if (hc != null) {
                if (webhookOrgId != null && !webhookOrgId.isBlank() && !webhookOrgId.equalsIgnoreCase(hc.getOrganizationId())) {
                    log.warn("🚫 Webhook settlement REJECTED for HealthCareClaim {}: org mismatch", claimId);
                    return;
                }
                if (!"PAID".equalsIgnoreCase(hc.getStatus())) {
                    hc.setStatus("PAID");
                    healthCareClaimRepository.save(hc);
                    log.info("🎉 SUCCESS: HealthCareClaim {} marked PAID via webhook.", hc.getClaimNumber());
                }
            }
        }
    }

    /**
     * ═══════════════════════════════════════════════════════════════
     * AUTO SPLIT — Patient pays → Doctor ka % automatically UPI pe
     * ═══════════════════════════════════════════════════════════════
     * Jab bhi patient bill pay karta hai (direct ya webhook se),
     * assigned doctor ke UPI account pe automatically unka share
     * RazorpayX ke through instantly transfer ho jata hai.
     *
     * Flow:
     *   Patient pays ₹1000
     *     → Claim PAID ho gaya
     *     → Doctor ka commissionPercent = 40%
     *     → RazorpayX: doctor@phonepe pe ₹400 instant transfer
     *
     * Requirements:
     *   1. RAZORPAYX_KEY_ID, RAZORPAYX_KEY_SECRET, RAZORPAYX_ACCOUNT_NUMBER
     *      .env mein hona chahiye (live keys)
     *   2. Doctor ka UPI ID system mein linked hona chahiye
     *      (Provider Payments → Org Gateway & Accounts → Doctor Accounts)
     *   3. Doctor ka commissionPercent > 0 hona chahiye
     */
    private void triggerDoctorAutoSplit(Claim claim, String transactionRef) {
        if (razorpayPayoutService == null || doctorPaymentAccountRepository == null || claim == null) return;

        try {
            String orgId = claim.getOrganizationId();

            // Step 1: Assigned doctor ka account dhundo
            java.util.Optional<com.healthcare.epcr.billing.model.DoctorPaymentAccount> docAccountOpt;
            if (claim.getDoctorUserId() != null && !claim.getDoctorUserId().isBlank()) {
                docAccountOpt = doctorPaymentAccountRepository
                        .findByOrganizationIdAndDoctorUserId(orgId, claim.getDoctorUserId());
            } else {
                // Fallback: org ka koi bhi active doctor account
                docAccountOpt = doctorPaymentAccountRepository
                        .findByOrganizationId(orgId)
                        .stream()
                        .filter(a -> Boolean.TRUE.equals(a.getActive()) && a.getUpiId() != null && !a.getUpiId().isBlank())
                        .findFirst();
            }

            if (docAccountOpt.isEmpty()) {
                log.info("[AutoSplit] Claim {} — No linked doctor payment account found. Skipping auto-split.", claim.getClaimNumber());
                return;
            }

            com.healthcare.epcr.billing.model.DoctorPaymentAccount docAccount = docAccountOpt.get();

            // Step 2: UPI ID check
            if (docAccount.getUpiId() == null || docAccount.getUpiId().isBlank()) {
                log.warn("[AutoSplit] Claim {} — Doctor {} has no UPI ID linked. Skipping auto-split.",
                        claim.getClaimNumber(), docAccount.getDoctorName());
                return;
            }

            // Step 3: Commission % check
            if (docAccount.getCommissionPercent() == null || docAccount.getCommissionPercent().doubleValue() <= 0) {
                log.warn("[AutoSplit] Claim {} — Doctor {} has 0% commission configured. Skipping auto-split.",
                        claim.getClaimNumber(), docAccount.getDoctorName());
                return;
            }

            // Step 4: Doctor ka share calculate karo (server-side, never trust client)
            BigDecimal claimTotal = claim.getTotalPaid() != null && claim.getTotalPaid().compareTo(BigDecimal.ZERO) > 0
                    ? claim.getTotalPaid()
                    : (claim.getTotalCharged() != null ? claim.getTotalCharged() : BigDecimal.ZERO);

            BigDecimal commPercent = docAccount.getCommissionPercent();
            BigDecimal doctorShare = claimTotal
                    .multiply(commPercent)
                    .divide(BigDecimal.valueOf(100), 2, java.math.RoundingMode.HALF_UP);

            if (doctorShare.compareTo(BigDecimal.ZERO) <= 0) {
                log.warn("[AutoSplit] Calculated doctor share is ₹0 for claim {}. Skipping.", claim.getClaimNumber());
                return;
            }

            log.info("[AutoSplit] Claim {} PAID ₹{} → Doctor {} gets {}% = ₹{} → UPI: {}",
                    claim.getClaimNumber(), claimTotal, docAccount.getDoctorName(),
                    commPercent, doctorShare, docAccount.getUpiId());

            // Step 5: Org ke DB-stored keys fetch karo (UI mein paste ki gayi keys)
            String orgKeyId = null, orgKeySecret = null, orgAccountNo = null;
            if (orgPaymentGatewayConfigRepository != null) {
                var cfgOpt = orgPaymentGatewayConfigRepository.findByOrganizationIdAndActiveTrue(orgId);
                if (cfgOpt.isPresent()) {
                    var cfg = cfgOpt.get();
                    orgKeyId     = cfg.getKeyId();
                    orgKeySecret = cfg.getKeySecret();
                    orgAccountNo = cfg.getRazorpayxAccountNumber();
                }
            }

            // Step 6: RazorpayX UPI Payout fire karo (org keys first, .env fallback)
            java.util.Map<String, Object> result = razorpayPayoutService.executeUpiPayout(
                    docAccount.getUpiId(),
                    doctorShare.doubleValue(),
                    docAccount.getDoctorName(),
                    claim.getClaimNumber(),
                    orgId,
                    orgKeyId,
                    orgKeySecret,
                    orgAccountNo
            );

            log.info("[AutoSplit] ✅ Payout SUCCESS for Claim {} → Doctor {} → ₹{} → UPI {} | PayoutId: {} | Mode: {}",
                    claim.getClaimNumber(), docAccount.getDoctorName(), doctorShare,
                    docAccount.getUpiId(), result.get("payoutId"), result.get("mode"));

        } catch (Exception ex) {
            // Non-blocking — payment receipt already sent, just log the split failure
            log.error("[AutoSplit] ❌ Auto-split FAILED for claim {} — {} (Payment was still marked PAID, split can be retried manually)",
                    claim != null ? claim.getClaimNumber() : "UNKNOWN", ex.getMessage());
        }
    }

    private void sendDoctorAgreedPaymentEmail(Claim claim, String transactionRef) {
        if (emailService == null || doctorPaymentAccountRepository == null) return;
        try {
            String orgId = claim.getOrganizationId() != null ? claim.getOrganizationId() : TenantContext.currentOrganizationId();
            List<com.healthcare.epcr.billing.model.DoctorPaymentAccount> docAccounts;

            if (claim.getDoctorUserId() != null && !claim.getDoctorUserId().isBlank()) {
                var singleOpt = doctorPaymentAccountRepository.findByOrganizationIdAndDoctorUserId(orgId, claim.getDoctorUserId());
                docAccounts = singleOpt.map(List::of).orElseGet(() -> doctorPaymentAccountRepository.findByOrganizationId(orgId));
            } else {
                docAccounts = doctorPaymentAccountRepository.findByOrganizationId(orgId);
            }

            if (docAccounts == null || docAccounts.isEmpty()) return;

            BigDecimal totalAmount = claim.getPatientResponsibility() != null && claim.getPatientResponsibility().compareTo(BigDecimal.ZERO) > 0
                    ? claim.getPatientResponsibility()
                    : (claim.getTotalCharged() != null ? claim.getTotalCharged() : BigDecimal.ZERO);

            for (var docAcc : docAccounts) {
                if (Boolean.FALSE.equals(docAcc.getActive())) continue;
                String docEmail = null;
                if (userRepository != null && docAcc.getDoctorUserId() != null) {
                    var userOpt = userRepository.findById(docAcc.getDoctorUserId());
                    if (userOpt.isPresent() && userOpt.get().getEmail() != null && !userOpt.get().getEmail().isBlank()) {
                        docEmail = userOpt.get().getEmail();
                    }
                }
                if ((docEmail == null || docEmail.isBlank()) && docAcc.getEmail() != null && !docAcc.getEmail().isBlank()) {
                    docEmail = docAcc.getEmail();
                }
                if (docEmail == null || docEmail.isBlank()) continue;

                BigDecimal commRate = docAcc.getCommissionPercent() != null ? docAcc.getCommissionPercent() : BigDecimal.valueOf(15.0);
                BigDecimal docEarned = totalAmount.multiply(commRate).divide(BigDecimal.valueOf(100), 2, java.math.RoundingMode.HALF_UP);

                String subject = "💰 Doctor Agreed Payment Receipt — Claim #" + claim.getClaimNumber() + " (₹" + docEarned + " INR)";
                String htmlBody = "<div style='font-family: Arial, sans-serif; padding: 24px; color: #1e293b; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;'>" +
                        "<div style='border-bottom: 2px solid #10b981; padding-bottom: 12px; margin-bottom: 16px;'>" +
                        "<h2 style='color: #047857; margin: 0; font-size: 20px;'>Smart-eHR Agreed Payment Settlement Notification</h2>" +
                        "<p style='margin: 4px 0 0 0; color: #64748b; font-size: 13px;'>Automated Provider Payout Receipt</p></div>" +
                        "<p style='font-size: 14px;'>Dear <strong>Dr. " + HtmlUtils.htmlEscape(docAcc.getDoctorName() != null ? docAcc.getDoctorName() : "Physician") + "</strong>,</p>" +
                        "<p style='font-size: 14px; color: #334155;'>A patient bill settlement has been processed for Claim <strong>#" + claim.getClaimNumber() + "</strong>.</p>" +
                        "<div style='background-color: #ecfdf5; padding: 18px; border-radius: 10px; border-left: 5px solid #10b981; margin: 20px 0;'>" +
                        "<p style='margin: 0; font-size: 12px; text-transform: uppercase; color: #047857; font-weight: bold;'>Total Bill Amount: ₹" + totalAmount + " INR</p>" +
                        "<p style='margin: 4px 0 0 0; font-size: 12px; color: #047857;'>Your Agreed Payment Rate: <strong>" + commRate + "%</strong></p>" +
                        "<p style='margin: 10px 0 0 0; font-size: 26px; font-weight: 800; color: #065f46;'>Earned Share: ₹" + docEarned + " INR</p>" +
                        "</div>" +
                        "<table style='width: 100%; border-collapse: collapse; font-size: 13px; margin: 16px 0;'>" +
                        "<tr><td style='padding: 6px 0; color: #64748b;'>Payout Account Type:</td><td style='padding: 6px 0; font-weight: bold; text-align: right;'>" + docAcc.getAccountType() + "</td></tr>" +
                        "<tr><td style='padding: 6px 0; color: #64748b;'>Account Details / UPI:</td><td style='padding: 6px 0; font-weight: bold; text-align: right;'>" + (docAcc.getUpiId() != null ? docAcc.getUpiId() : (docAcc.getAccountNumber() != null ? docAcc.getAccountNumber() : (docAcc.getLinkedAccountRef() != null ? docAcc.getLinkedAccountRef() : "N/A"))) + "</td></tr>" +
                        "<tr><td style='padding: 6px 0; color: #64748b;'>Transaction Ref:</td><td style='padding: 6px 0; font-weight: bold; font-family: monospace; text-align: right;'>" + HtmlUtils.htmlEscape(transactionRef) + "</td></tr>" +
                        "</table>" +
                        "<p style='font-size: 12px; color: #94a3b8; margin-top: 20px; border-top: 1px solid #f1f5f9; padding-top: 12px;'>This payout advice is automatically logged in your Organization's Provider Payout Ledger in Smart-eHR.</p>" +
                        "</div>";

                emailService.sendEmail(docEmail, subject, htmlBody);
                log.info("📧 Doctor agreed payment receipt email dispatched to: {} for claim: {}", docEmail, claim.getClaimNumber());
            }
        } catch (Exception ex) {
            log.error("Failed to send doctor agreed payment receipt email for claim {}: {}", claim.getClaimNumber(), ex.getMessage());
        }
    }

    // ---------- helpers ----------

    private String generateClaimNumber(String orgId) {
        try {
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
            log.warn("Failed to generate sequence counter from MongoDB, fallback to timestamp suffix: {}", ex.getMessage());
            return "CLM-" + LocalDateTime.now().getYear() + "-" + String.format("%06d", System.currentTimeMillis() % 1000000);
        }
    }

    private void sendPaymentReceiptEmail(Claim claim, String paymentMethod, String transactionRef) {
        try {
            if (claim == null || emailService == null) return;
            String targetEmail = null;
            String patientName = "Valued Patient";
            String facilityCode = null;
            String providerBillingNumber = null;
            List<ClaimItem> hcItems = null;

            // 1. PHI SECURITY: Target email MUST be sourced ONLY from the official registered patient repository
            if (claim.getPatientId() != null && patientRepository != null) {
                var pOpt = patientRepository.findByPatientId(claim.getPatientId())
                        .or(() -> patientRepository.findById(claim.getPatientId()));
                if (pOpt.isPresent()) {
                    if (pOpt.get().getEmail() != null && !pOpt.get().getEmail().isBlank()) {
                        targetEmail = pOpt.get().getEmail();
                    }
                    if (pOpt.get().getPatientId() != null) {
                        patientName = pOpt.get().getPatientId();
                    }
                }
            }

            // 2. HealthCareClaim repository — use ONLY for non-PHI facility enrichment and line items.
            // PHI SECURITY: NEVER source targetEmail from payerDetails or payerId (protects against HIPAA data leak).
            if (healthCareClaimRepository != null) {
                HealthCareClaim hc = healthCareClaimRepository.findById(claim.getId())
                        .or(() -> healthCareClaimRepository.findByClaimNumber(claim.getClaimNumber()))
                        .orElse(null);
                if (hc != null) {
                    if (hc.getPatientName() != null && !hc.getPatientName().isBlank()) {
                        patientName = hc.getPatientName();
                    }
                    if (hc.getFacilityCode() != null && !hc.getFacilityCode().isBlank()) {
                        facilityCode = hc.getFacilityCode();
                    }
                    if (hc.getProviderBillingNumber() != null && !hc.getProviderBillingNumber().isBlank()) {
                        providerBillingNumber = hc.getProviderBillingNumber();
                    }
                    hcItems = hc.getItems();
                }
            }

            if (targetEmail == null || targetEmail.isBlank()) {
                log.info("⚠️ [NOTICE] Skipping payment receipt email for claim {} — no registered patient email found.", claim.getClaimNumber());
                return;
            }

            double amountPaid = claim.getTotalPaid() != null ? claim.getTotalPaid().doubleValue()
                    : (claim.getTotalCharged() != null ? claim.getTotalCharged().doubleValue() : 0.0);
            String receiptNo = "REC-" + System.currentTimeMillis();
            String subject = "Official Payment Receipt: #" + claim.getClaimNumber() + " - Smart-eHR Billing";

            StringBuilder itemsHtml = new StringBuilder();
            itemsHtml.append("<table style='width:100%;border-collapse:collapse;font-size:13px;margin-top:12px;'>")
                     .append("<thead style='background:#f1f5f9;color:#334155;'>")
                     .append("<tr>")
                     .append("<th style='padding:10px;border:1px solid #e2e8f0;text-align:left;'>Code</th>")
                     .append("<th style='padding:10px;border:1px solid #e2e8f0;text-align:left;'>Service / Item Description</th>")
                     .append("<th style='padding:10px;border:1px solid #e2e8f0;text-align:center;'>Qty</th>")
                     .append("<th style='padding:10px;border:1px solid #e2e8f0;text-align:right;'>Unit Rate (₹)</th>")
                     .append("<th style='padding:10px;border:1px solid #e2e8f0;text-align:right;'>Total Paid (₹)</th>")
                     .append("</tr></thead><tbody>");

            boolean hasItems = false;
            if (claim.getLineItems() != null && !claim.getLineItems().isEmpty()) {
                for (var item : claim.getLineItems()) {
                    hasItems = true;
                    double unit = item.getUnitCharge() != null ? item.getUnitCharge().doubleValue() : 0.0;
                    double total = item.getLineTotal() != null ? item.getLineTotal().doubleValue() : (unit * item.getQuantity());
                    itemsHtml.append("<tr>")
                             .append("<td style='padding:10px;border:1px solid #e2e8f0;font-family:monospace;font-weight:bold;'>").append(HtmlUtils.htmlEscape(item.getCptOrHcpcsCode() != null ? item.getCptOrHcpcsCode() : "PROC")).append("</td>")
                             .append("<td style='padding:10px;border:1px solid #e2e8f0;'>").append(HtmlUtils.htmlEscape(item.getDescription() != null ? item.getDescription() : "Medical Procedure")).append("</td>")
                             .append("<td style='padding:10px;border:1px solid #e2e8f0;text-align:center;'>").append(item.getQuantity()).append("</td>")
                             .append("<td style='padding:10px;border:1px solid #e2e8f0;text-align:right;'>₹").append(String.format("%.2f", unit)).append("</td>")
                             .append("<td style='padding:10px;border:1px solid #e2e8f0;text-align:right;font-weight:bold;color:#059669;'>₹").append(String.format("%.2f", total)).append("</td>")
                             .append("</tr>");
                }
            } else if (hcItems != null && !hcItems.isEmpty()) {
                for (var item : hcItems) {
                    hasItems = true;
                    double unit = item.getUnitPrice() != null ? item.getUnitPrice() : 0.0;
                    double total = item.getTotal() != null ? item.getTotal() : (unit * (item.getQuantity() != null ? item.getQuantity() : 1));
                    itemsHtml.append("<tr>")
                             .append("<td style='padding:10px;border:1px solid #e2e8f0;font-family:monospace;font-weight:bold;'>").append(HtmlUtils.htmlEscape(item.getServiceCode() != null ? item.getServiceCode() : "PROC")).append("</td>")
                             .append("<td style='padding:10px;border:1px solid #e2e8f0;'>").append(HtmlUtils.htmlEscape(item.getDescription() != null ? item.getDescription() : "Clinical Procedure")).append("</td>")
                             .append("<td style='padding:10px;border:1px solid #e2e8f0;text-align:center;'>").append(item.getQuantity() != null ? item.getQuantity() : 1).append("</td>")
                             .append("<td style='padding:10px;border:1px solid #e2e8f0;text-align:right;'>₹").append(String.format("%.2f", unit)).append("</td>")
                             .append("<td style='padding:10px;border:1px solid #e2e8f0;text-align:right;font-weight:bold;color:#059669;'>₹").append(String.format("%.2f", total)).append("</td>")
                             .append("</tr>");
                }
            }

            if (!hasItems) {
                itemsHtml.append("<tr><td colspan='5' style='padding:12px;border:1px solid #e2e8f0;text-align:center;color:#64748b;'>Standard Emergency Care & Service Invoice Settled</td></tr>");
            }
            itemsHtml.append("</tbody></table>");

            String method = paymentMethod != null ? paymentMethod.toUpperCase() : "RAZORPAY";
            String txnRef = transactionRef != null ? transactionRef : ("TXN-" + System.currentTimeMillis());

            String body = "<div style='font-family:Arial,sans-serif;padding:28px;color:#1f2937;max-width:680px;border:1px solid #cbd5e1;border-radius:12px;background:#fff;'>" +
                    "<div style='border-bottom:2px solid #059669;padding-bottom:16px;margin-bottom:20px;'>" +
                    "<h2 style='color:#059669;margin:0;font-size:22px;'>Smart-eHR Payment Receipt</h2>" +
                    "<p style='margin:4px 0 0;color:#64748b;font-size:13px;'>GNWT Dept of Health & Social Services / Billing & Finance Division</p>" +
                    "</div>" +
                    "<div style='background:#ecfdf5;border:1px solid #a7f3d0;padding:14px;border-radius:8px;margin-bottom:20px;color:#065f46;font-size:14px;font-weight:bold;text-align:center;'>✔ PAYMENT CONFIRMED & INVOICE SETTLED</div>" +
                    "<p style='font-size:15px;'>Dear <strong>" + HtmlUtils.htmlEscape(patientName) + "</strong>,</p>" +
                    "<p style='font-size:14px;color:#334155;'>Thank you for your payment. Claim <strong>#" + HtmlUtils.htmlEscape(claim.getClaimNumber()) + "</strong> has been successfully paid and settled.</p>" +
                    
                    "<h3 style='color:#0f172a;font-size:15px;margin-top:20px;margin-bottom:8px;'>🏢 Healthcare Facility Information</h3>" +
                    "<div style='background:#f8fafc;padding:16px;border-radius:10px;border:1px solid #e2e8f0;margin:10px 0;font-size:13px;color:#334155;'>" +
                    "<p style='margin:4px 0;'><strong>Patient Reference:</strong> " + HtmlUtils.htmlEscape(patientName) + " (" + HtmlUtils.htmlEscape(claim.getPatientId() != null ? claim.getPatientId() : "PAT-REF") + ")</p>" +
                    "<p style='margin:4px 0;'><strong>Facility / Clinic:</strong> " + HtmlUtils.htmlEscape(facilityCode != null ? facilityCode : "General Medical Facility") + "</p>" +
                    "<p style='margin:4px 0;'><strong>Provider Billing Number:</strong> " + HtmlUtils.htmlEscape(providerBillingNumber != null ? providerBillingNumber : "PRIMARY-CARE-PROVIDER") + "</p>" +
                    "</div>" +

                    "<h3 style='color:#0f172a;font-size:15px;margin-top:20px;margin-bottom:8px;'>💳 Payment Transaction Summary</h3>" +
                    "<div style='background:#f8fafc;padding:16px;border-radius:10px;border:1px solid #e2e8f0;margin:10px 0;font-size:13px;color:#334155;'>" +
                    "<p style='margin:4px 0;'><strong>Receipt Number:</strong> " + receiptNo + "</p>" +
                    "<p style='margin:4px 0;'><strong>Razorpay / Txn Ref:</strong> <span style='font-family:monospace;font-weight:bold;color:#059669;'>" + HtmlUtils.htmlEscape(txnRef) + "</span></p>" +
                    "<p style='margin:4px 0;'><strong>Payment Method:</strong> " + HtmlUtils.htmlEscape(method) + "</p>" +
                    "</div>" +

                    "<h3 style='color:#0f172a;font-size:15px;margin-top:20px;margin-bottom:8px;'>📋 Settled Services Breakdown</h3>" +
                    itemsHtml +

                    "<div style='background:#f0fdf4;padding:18px;border-radius:10px;border-left:5px solid #059669;margin:24px 0;text-align:right;'>" +
                    "<p style='margin:0;font-size:13px;color:#047857;text-transform:uppercase;'>Total Amount Settled:</p>" +
                    "<p style='margin:6px 0 0;font-size:28px;font-weight:800;color:#065f46;'>₹" + String.format("%.2f", amountPaid) + " INR</p>" +
                    "</div>" +

                    "<div style='text-align:center;margin-top:24px;'><a href='" + frontendBaseUrl + "/patient-portal' style='background:#059669;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;display:inline-block;'>Log In to Patient Portal for Clinical Records</a></div>" +
                    "</div>";

            byte[] pdfBytes = null;
            if (pdfReceiptGeneratorService != null) {
                pdfBytes = pdfReceiptGeneratorService.generatePaymentReceiptPdf(
                        claim, patientName, facilityCode, providerBillingNumber, hcItems, method, txnRef, amountPaid
                );
            }

            String pdfFilename = "Payment_Receipt_" + (claim.getClaimNumber() != null ? claim.getClaimNumber() : "CLM-PAYMENT") + ".pdf";

            if (pdfBytes != null && pdfBytes.length > 0) {
                emailService.sendEmailWithAttachment(targetEmail, subject, body, pdfFilename, pdfBytes);
                log.info("Payment receipt email WITH PDF ATTACHMENT ({}) dispatched to registered patient {} for claim {} (method={})", pdfFilename, targetEmail, claim.getClaimNumber(), method);
            } else {
                emailService.sendEmail(targetEmail, subject, body);
                log.info("Payment receipt email dispatched to registered patient {} for claim {} (method={})", targetEmail, claim.getClaimNumber(), method);
            }
        } catch (Exception ex) {
            log.error("Failed to send payment receipt email for claim {}: {}", claim != null ? claim.getClaimNumber() : "unknown", ex.getMessage());
        }
    }

    private static class AtomicLongHolder {
        static final AtomicLong NEXT = new AtomicLong(1);
    }
}
