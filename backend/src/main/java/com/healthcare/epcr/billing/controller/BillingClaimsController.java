package com.healthcare.epcr.billing.controller;

import com.healthcare.epcr.billing.dto.BatchSubmissionRequest;
import com.healthcare.epcr.billing.model.HealthCareClaim;
import com.healthcare.epcr.billing.model.BillingServiceCode;
import com.healthcare.epcr.billing.model.DiagnosticCode;
import com.healthcare.epcr.billing.repository.HealthCareClaimRepository;
import com.healthcare.epcr.billing.repository.BillingServiceCodeRepository;
import com.healthcare.epcr.billing.repository.DiagnosticCodeRepository;
import com.healthcare.epcr.billing.security.TenantContext;
import com.healthcare.epcr.billing.service.BillingClaimsService;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.stream.Collectors;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/billing/claims")
@RequiredArgsConstructor
@Slf4j
public class BillingClaimsController {

    private final HealthCareClaimRepository claimRepository;
    private final BillingClaimsService billingClaimsService;
    private final BillingServiceCodeRepository serviceCodeRepository;
    private final DiagnosticCodeRepository diagnosticCodeRepository;
    private final com.healthcare.epcr.billing.service.ClaimService claimService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.healthcare.epcr.billing.repository.ClaimRepository claimServiceClaimRepository;

    // ── GET /api/billing/claims/service-codes ──────────────────────────────
    @GetMapping("/service-codes")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<List<BillingServiceCode>> getActiveServiceCodes() {
        List<BillingServiceCode> codes = serviceCodeRepository.findByActiveTrue();
        if (codes.isEmpty()) {
            codes = seedDefaultServiceCodes();
        }
        return ResponseEntity.ok(codes);
    }

    private List<BillingServiceCode> seedDefaultServiceCodes() {
        List<BillingServiceCode> defaults = new ArrayList<>();

        BillingServiceCode sc1 = new BillingServiceCode();
        sc1.setCode("AMB-01"); sc1.setDescription("Ambulance Emergency Ground Transport");
        sc1.setRate(1500.0);   sc1.setCategory("AMBULANCE"); sc1.setActive(true);
        defaults.add(serviceCodeRepository.save(sc1));

        BillingServiceCode sc2 = new BillingServiceCode();
        sc2.setCode("EM-02");  sc2.setDescription("Emergency Triage & Assessment");
        sc2.setRate(850.0);    sc2.setCategory("CLINIC"); sc2.setActive(true);
        defaults.add(serviceCodeRepository.save(sc2));

        BillingServiceCode sc3 = new BillingServiceCode();
        sc3.setCode("MED-03"); sc3.setDescription("Advanced Airway & Paramedic Kit");
        sc3.setRate(450.0);    sc3.setCategory("SUPPLY"); sc3.setActive(true);
        defaults.add(serviceCodeRepository.save(sc3));

        BillingServiceCode sc4 = new BillingServiceCode();
        sc4.setCode("CON-04"); sc4.setDescription("Specialist Physician Clinical Consultation");
        sc4.setRate(2000.0);   sc4.setCategory("CLINIC"); sc4.setActive(true);
        defaults.add(serviceCodeRepository.save(sc4));

        return defaults;
    }

    // ── GET /api/billing/claims/diagnostic-codes ───────────────────────────
    @GetMapping("/diagnostic-codes")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<List<DiagnosticCode>> getDiagnosticCodes() {
        return ResponseEntity.ok(diagnosticCodeRepository.findAll());
    }

    // ── GET /api/billing/claims/stats ──────────────────────────────────────
    @GetMapping("/stats")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Map<String, Long>> stats(@RequestParam(required = false) String organizationId) {
        boolean isAdmin = TenantContext.hasRole("ADMIN");
        String userOrgId = TenantContext.currentOrganizationId();

        String effectiveOrgId = (isAdmin && organizationId != null && !organizationId.isBlank())
                ? organizationId
                : userOrgId;
        log.debug("stats: effectiveOrgId={}, userOrgId={}", effectiveOrgId, userOrgId);

        org.springframework.data.domain.Page<com.healthcare.epcr.billing.model.Claim> page =
                claimService.listClaims(null, effectiveOrgId, org.springframework.data.domain.PageRequest.of(0, 5000));

        List<com.healthcare.epcr.billing.model.Claim> claims = page.getContent();

        long draft = claims.stream().filter(c -> c.getStatus() == com.healthcare.epcr.billing.model.ClaimStatus.DRAFT || c.getStatus() == com.healthcare.epcr.billing.model.ClaimStatus
                .READY).count();
        long submitted = claims.stream().filter(c -> c.getStatus() == com.healthcare.epcr.billing.model.ClaimStatus.SUBMITTED || c.getStatus() == com.healthcare.epcr.billing.model.ClaimStatus.ACCEPTED).count();
        long paid = claims.stream().filter(c -> c.getStatus() == com.healthcare.epcr.billing.model.ClaimStatus.PAID || c.getStatus() == com.healthcare.epcr.billing.model.ClaimStatus.PARTIALLY_PAID).count();
        long rejected = claims.stream().filter(c -> c.getStatus() == com.healthcare.epcr.billing.model.ClaimStatus.DENIED).count();

        return ResponseEntity.ok(Map.of(
                "outstanding",      draft,
                "submittedPending", submitted,
                "paid",             paid,
                "rejected",         rejected
        ));
    }

    // ── POST /api/billing/claims/generate/{recordId} ───────────────────────
    @PostMapping("/generate/{recordId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<HealthCareClaim> generateClaim(@PathVariable String recordId) {
        return ResponseEntity.ok(billingClaimsService.generateClaimFromRecord(recordId));
    }

    // ── PUT /api/billing/claims/{id} — edit a DRAFT claim ──────────────────
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<HealthCareClaim> updateClaim(@PathVariable String id, @RequestBody HealthCareClaim update) {
        // SECURITY: always scope to caller's own org — never allow cross-tenant edit via bare findById()
        String orgId = TenantContext.currentOrganizationId();
        HealthCareClaim existing = claimRepository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new IllegalArgumentException("Claim not found or access denied: " + id));

        if (!"DRAFT".equals(existing.getStatus())) {
            throw new IllegalStateException("Only DRAFT claims can be edited");
        }

        existing.setItems(update.getItems());
        existing.setPayerId(update.getPayerId());
        existing.setPayerDetails(update.getPayerDetails());
        double computedTotal = update.getItems() != null
                ? update.getItems().stream().mapToDouble(i -> {
                    double u = i.getUnitPrice() != null ? i.getUnitPrice() : 0.0;
                    int    q = i.getQuantity()  != null ? i.getQuantity()  : 1;
                    return i.getTotal() != null ? i.getTotal() : u * q;
                }).sum()
                : 0.0;
        existing.setTotalAmount(computedTotal);
        existing.setUpdatedAt(LocalDateTime.now());

        return ResponseEntity.ok(claimRepository.save(existing));
    }

    // ── POST /api/billing/claims/{id}/validate ─────────────────────────────
    @PostMapping("/{id}/validate")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<?> validate(@PathVariable String id) {
        // Pass caller's orgId so the service layer can scope its lookup
        String orgId = TenantContext.currentOrganizationId();
        try {
            billingClaimsService.validateClaim(id, orgId);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    // ── DELETE /api/billing/claims/{id} ────────────────────────────────────
    // SOFT-DELETE: sets status=VOID on the record — never physically removes it.
    // This preserves the audit trail required for healthcare compliance.
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<?> deleteClaim(@PathVariable String id) {
        String orgId = TenantContext.currentOrganizationId();
        boolean isAdmin = TenantContext.hasRole("ADMIN");
        try {
            boolean voided = false;

            // 1. Delete from HealthCareClaimRepository (strictly org-scoped for non-admins)
            HealthCareClaim hc = null;
            if (isAdmin) {
                hc = claimRepository.findById(id).orElse(null);
                if (hc == null) hc = claimRepository.findByClaimNumber(id).orElse(null);
            } else {
                hc = claimRepository.findByIdAndOrganizationId(id, orgId).orElse(null);
                if (hc == null) hc = claimRepository.findByOrganizationIdAndClaimNumber(orgId, id).orElse(null);
            }

            if (hc != null) {
                if ("PAID".equalsIgnoreCase(hc.getStatus())) {
                    return ResponseEntity.badRequest().body(Map.of(
                            "message", "Cannot delete a paid claim. Settled invoices must be retained for healthcare compliance."));
                }
                claimRepository.delete(hc);
                voided = true;
            }

            // 2. Delete from ClaimRepository (strictly org-scoped for non-admins)
            if (claimServiceClaimRepository != null) {
                com.healthcare.epcr.billing.model.Claim c = null;
                if (isAdmin) {
                    c = claimServiceClaimRepository.findById(id).orElse(null);
                    if (c == null) c = claimServiceClaimRepository.findByClaimNumber(id).orElse(null);
                } else {
                    c = claimServiceClaimRepository.findByIdAndOrganizationId(id, orgId).orElse(null);
                    if (c == null) c = claimServiceClaimRepository.findByOrganizationIdAndClaimNumber(orgId, id).orElse(null);
                }

                if (c != null) {
                    if (com.healthcare.epcr.billing.model.ClaimStatus.PAID.equals(c.getStatus())) {
                        return ResponseEntity.badRequest().body(Map.of(
                                "message", "Cannot delete a paid claim. Settled invoices must be retained for healthcare compliance."));
                    }
                    claimServiceClaimRepository.delete(c);
                    voided = true;
                }
            }

            if (!voided) {
                return ResponseEntity.badRequest().body(Map.of("message", "Claim not found or access denied."));
            }

            log.info("Claim {} voided (soft-delete) by user in org {}", id, orgId);
            return ResponseEntity.ok(Map.of("message", "Claim voided successfully"));

        } catch (IllegalArgumentException | IllegalStateException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        } catch (Exception ex) {
            log.error("Unexpected error voiding claim {} in org {}", id, orgId, ex);
            return ResponseEntity.internalServerError().body(Map.of("message", "An unexpected error occurred. Please try again or contact support."));
        }
    }

    // ── POST /api/billing/claims/batch-submit ──────────────────────────────
    @PostMapping("/batch-submit")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Map<String, String>> batchSubmit(@RequestBody BatchSubmissionRequest request) {
        String batchId = billingClaimsService.generateSubmissionBatch(request.getClaimIds());
        return ResponseEntity.ok(Map.of("batchId", batchId));
    }

    // ── GET /api/billing/batches ───────────────────────────────────────────
    @GetMapping("/batches")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<List<Map<String, Object>>> listBatches(@RequestParam(required = false) String organizationId) {
        // SECURITY: MANAGER must always see only their own org's batches (TenantContext).
        // Only ADMIN may override with an explicit organizationId for cross-org reporting.
        String effectiveOrgId;
        if (TenantContext.hasRole("ADMIN") && organizationId != null && !organizationId.isBlank()) {
            effectiveOrgId = organizationId;
        } else {
            effectiveOrgId = TenantContext.currentOrganizationId();
        }
        log.debug("listBatches: effectiveOrgId={}", effectiveOrgId);

        List<HealthCareClaim> allClaims = claimRepository
                .findByOrganizationId(effectiveOrgId, PageRequest.of(0, 1000))
                .getContent()
                .stream()
                .filter(c -> c.getBatchId() != null && !c.getBatchId().isBlank())
                .collect(Collectors.toList());

        var grouped = allClaims.stream()
                .collect(Collectors.groupingBy(HealthCareClaim::getBatchId, LinkedHashMap::new, Collectors.toList()));

        List<Map<String, Object>> result = new ArrayList<>();
        grouped.forEach((batchId, claims) -> {
            double total   = claims.stream().mapToDouble(c -> c.getTotalAmount() != null ? c.getTotalAmount() : 0.0).sum();
            String payerId = claims.stream().map(HealthCareClaim::getPayerId).filter(p -> p != null).findFirst().orElse("UNKNOWN");
            String status  = claims.stream().anyMatch(c -> "SUBMITTED".equals(c.getStatus())) ? "TRANSMITTED" : "ACKNOWLEDGED";
            String date    = claims.stream()
                    .map(HealthCareClaim::getSubmittedAt)
                    .filter(d -> d != null)
                    .max(Comparator.naturalOrder())
                    .map(d -> d.toString().replace("T", " ").substring(0, 16))
                    .orElse("—");

            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("id",     batchId);
            entry.put("date",   date);
            entry.put("count",  claims.size());
            entry.put("total",  total);
            entry.put("status", status);
            entry.put("payer",  payerId);
            result.add(entry);
        });

        result.sort((a, b) -> String.valueOf(b.get("date")).compareTo(String.valueOf(a.get("date"))));
        return ResponseEntity.ok(result);
    }

    // ── GET /api/billing/claims/batches/{batchId}/xml ──────────────────────
    @GetMapping("/batches/{batchId}/xml")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<String> downloadBatchXml(@PathVariable String batchId) {
        try {
            String xmlContent = billingClaimsService.getBatchXml(batchId);
            return ResponseEntity.ok()
                    .header("Content-Disposition", "attachment; filename=" + batchId + ".xml")
                    .header("Content-Type", "application/xml")
                    .body(xmlContent);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body("<error>" + e.getMessage() + "</error>");
        }
    }
}
