package com.healthcare.epcr.billing.service;

import com.healthcare.epcr.billing.model.PayoutLineItem;
import com.healthcare.epcr.billing.model.ProviderPayout;
import com.healthcare.epcr.billing.model.ProviderPaymentRate;
import com.healthcare.epcr.billing.model.ProviderShiftLog;
import com.healthcare.epcr.billing.repository.ProviderPayoutRepository;
import com.healthcare.epcr.billing.repository.ProviderPaymentRateRepository;
import com.healthcare.epcr.billing.repository.ProviderShiftLogRepository;
import com.healthcare.epcr.user.model.User;
import com.healthcare.epcr.user.repository.UserRepository;
import com.healthcare.epcr.billing.security.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ProviderPayoutService {

    private final ProviderPaymentRateRepository rateRepository;
    private final ProviderShiftLogRepository shiftLogRepository;
    private final ProviderPayoutRepository payoutRepository;
    private final UserRepository userRepository;
    private final MongoTemplate mongoTemplate;

    // ── RATES CRUD ──────────────────────────────────────────

    public ProviderPaymentRate createRate(ProviderPaymentRate rate) {
        // Deactivate existing rates for this provider in this org
        rateRepository.findByProviderIdAndOrganizationIdAndActiveTrue(rate.getProviderId(), rate.getOrganizationId())
                .ifPresent(existing -> {
                    existing.setActive(false);
                    existing.setEffectiveTo(LocalDate.now());
                    existing.setUpdatedAt(LocalDateTime.now());
                    rateRepository.save(existing);
                });

        rate.setActive(true);
        rate.setEffectiveFrom(rate.getEffectiveFrom() != null ? rate.getEffectiveFrom() : LocalDate.now());
        rate.setCreatedAt(LocalDateTime.now());
        rate.setUpdatedAt(LocalDateTime.now());
        return rateRepository.save(rate);
    }

    public List<ProviderPaymentRate> getRatesByOrg(String orgId) {
        return rateRepository.findByOrganizationId(orgId);
    }

    public Optional<ProviderPaymentRate> getActiveRateForProvider(String providerId, String orgId) {
        return rateRepository.findByProviderIdAndOrganizationIdAndActiveTrue(providerId, orgId);
    }

    public Optional<ProviderPaymentRate> getActiveRateForProvider(String providerId) {
        return rateRepository.findByProviderIdAndActiveTrue(providerId);
    }

    // ── SHIFT LOG IDEMPOTENT CREATION ────────────────────────

    public ProviderShiftLog logShiftFromSource(String providerId, LocalDateTime start, LocalDateTime end, String sourceType, String sourceRefId, String orgId) {
        Optional<ProviderShiftLog> existing = shiftLogRepository.findBySourceTypeAndSourceRefIdAndOrganizationId(sourceType, sourceRefId, orgId);
        if (existing.isPresent()) {
            log.info("[ProviderPayout] Shift log already exists for source type {} and refId {} in org {}", sourceType, sourceRefId, orgId);
            return existing.get();
        }

        double hoursWorked = 0.0;
        if (start != null && end != null) {
            hoursWorked = java.time.Duration.between(start, end).toMinutes() / 60.0;
        }

        ProviderShiftLog logEntry = ProviderShiftLog.builder()
                .providerId(providerId)
                .shiftStart(start)
                .shiftEnd(end)
                .hoursWorked(hoursWorked)
                .sourceType(sourceType)
                .sourceRefId(sourceRefId)
                .status("CLOSED")
                .organizationId(orgId)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        log.info("[ProviderPayout] Created shift log for provider {} from source {} (ref: {}), hours: {}", providerId, sourceType, sourceRefId, hoursWorked);
        return shiftLogRepository.save(logEntry);
    }

    // ── PAYOUT GENERATION ENGINE ─────────────────────────────

    public ProviderPayout generatePayout(String providerId, LocalDate periodStart, LocalDate periodEnd, String orgId) {
        // Strict org-scoped rate config fetch (no cross-tenant fallback)
        ProviderPaymentRate rate = rateRepository.findByProviderIdAndOrganizationIdAndActiveTrue(providerId, orgId)
                .orElseThrow(() -> new IllegalArgumentException("No active payment rate config found for provider ID: " + providerId + " in org: " + orgId));

        // Fetch provider display name
        String providerName = "Provider-" + providerId;
        Optional<User> userOpt = userRepository.findById(providerId);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            providerName = user.getFirstName() + " " + user.getLastName();
        }

        // Strict org-scoped closed shift logs in range
        List<ProviderShiftLog> shifts = shiftLogRepository.findByProviderIdAndOrganizationIdAndStatus(providerId, orgId, "CLOSED");

        List<ProviderShiftLog> eligibleShifts = shifts.stream()
                .filter(s -> s.getShiftStart() != null &&
                        !s.getShiftStart().toLocalDate().isBefore(periodStart) &&
                        !s.getShiftStart().toLocalDate().isAfter(periodEnd))
                .collect(Collectors.toList());

        if (eligibleShifts.isEmpty()) {
            throw new IllegalStateException("No closed shifts found in the range " + periodStart + " to " + periodEnd + " for provider " + providerName);
        }

        List<String> shiftIds = eligibleShifts.stream().map(ProviderShiftLog::getId).collect(Collectors.toList());

        // STEP 1: LOCK-FIRST PATTERN — Atomically claim closed shifts BEFORE computing earnings
        String lockToken = "PENDING-" + java.util.UUID.randomUUID();
        var lockResult = mongoTemplate.updateMulti(
                Query.query(Criteria.where("id").in(shiftIds).and("status").is("CLOSED")),
                Update.update("status", "LOCKED").set("payoutId", lockToken),
                ProviderShiftLog.class
        );

        if (lockResult.getModifiedCount() != shiftIds.size()) {
            // Concurrent execution detected — release any shifts locked in this run and abort safely
            mongoTemplate.updateMulti(
                    Query.query(Criteria.where("id").in(shiftIds).and("payoutId").is(lockToken)),
                    Update.update("status", "CLOSED").unset("payoutId"),
                    ProviderShiftLog.class
            );
            throw new IllegalStateException("Some shifts were already claimed by a concurrent payout run — please retry.");
        }

        // STEP 2: Calculate earnings safely now that shifts are exclusively locked
        double totalHours = 0.0;
        double shiftEarnings = 0.0;
        double procedureEarnings = 0.0;
        List<PayoutLineItem> lineItems = new ArrayList<>();

        for (ProviderShiftLog shift : eligibleShifts) {
            double shiftHours = shift.getHoursWorked() != null ? shift.getHoursWorked() : 0.0;
            totalHours += shiftHours;

            double lineAmount = 0.0;
            String desc = "";

            if ("FEE_FOR_SERVICE".equals(rate.getPaymentType())) {
                double procRate = rate.getFeePerProcedure() != null ? rate.getFeePerProcedure() : 0.0;
                if (rate.getProcedureRateOverrides() != null && rate.getProcedureRateOverrides().containsKey(shift.getSourceType())) {
                    procRate = rate.getProcedureRateOverrides().get(shift.getSourceType());
                }
                lineAmount = procRate;
                procedureEarnings += lineAmount;
                desc = "Fee-For-Service: " + shift.getSourceType() + " (Ref: " + shift.getSourceRefId() + ")";

                lineItems.add(PayoutLineItem.builder()
                        .sourceType("PROCEDURE")
                        .sourceRefId(shift.getSourceRefId())
                        .description(desc)
                        .amount(lineAmount)
                        .build());
            } else {
                // SALARY, SHIFT_RATE, HYBRID
                double hourlyRate = rate.getBaseRate() != null ? rate.getBaseRate() : 0.0;
                lineAmount = shiftHours * hourlyRate;
                shiftEarnings += lineAmount;
                desc = "Hours worked: " + String.format("%.2f", shiftHours) + " hrs @ $" + String.format("%.2f", hourlyRate) + "/hr (Source: " + shift.getSourceType() + ")";

                lineItems.add(PayoutLineItem.builder()
                        .sourceType("SHIFT")
                        .sourceRefId(shift.getSourceRefId())
                        .description(desc)
                        .amount(lineAmount)
                        .build());

                // HYBRID additional procedure incentive
                if ("HYBRID".equals(rate.getPaymentType()) && ("SURGICAL_CASE".equals(shift.getSourceType()) || "EPCR_INCIDENT".equals(shift.getSourceType()))) {
                    double procRate = rate.getFeePerProcedure() != null ? rate.getFeePerProcedure() : 0.0;
                    if (rate.getProcedureRateOverrides() != null && rate.getProcedureRateOverrides().containsKey(shift.getSourceType())) {
                        procRate = rate.getProcedureRateOverrides().get(shift.getSourceType());
                    }
                    if (procRate > 0) {
                        procedureEarnings += procRate;
                        String procDesc = "Procedure Incentive: " + shift.getSourceType() + " (Ref: " + shift.getSourceRefId() + ")";
                        lineItems.add(PayoutLineItem.builder()
                                .sourceType("PROCEDURE")
                                .sourceRefId(shift.getSourceRefId())
                                .description(procDesc)
                                .amount(procRate)
                                .build());
                    }
                }
            }
        }

        double totalPayout = shiftEarnings + procedureEarnings;

        ProviderPayout payout = ProviderPayout.builder()
                .providerId(providerId)
                .providerName(providerName)
                .payrollPeriodStart(periodStart)
                .payrollPeriodEnd(periodEnd)
                .totalHoursWorked(totalHours)
                .shiftEarnings(shiftEarnings)
                .totalProcedureEarnings(procedureEarnings)
                .lineItems(lineItems)
                .totalPayout(totalPayout)
                .approvalStatus("PENDING_REVIEW")
                .organizationId(orgId)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        ProviderPayout savedPayout = payoutRepository.save(payout);

        // STEP 3: Update locked shifts with saved payout ID
        mongoTemplate.updateMulti(
                Query.query(Criteria.where("id").in(shiftIds).and("payoutId").is(lockToken)),
                Update.update("payoutId", savedPayout.getId()),
                ProviderShiftLog.class
        );

        log.info("[ProviderPayout] Generated payout {} for provider {} amounting to ${}", savedPayout.getId(), providerName, totalPayout);
        return savedPayout;
    }

    // ── APPROVE & MARK PAID ─────────────────────────────────

    public ProviderPayout approvePayout(String payoutId, String approvedBy, String orgId) {
        ProviderPayout payout = payoutRepository.findById(payoutId)
                .orElseThrow(() -> new IllegalArgumentException("Payout not found: " + payoutId));
        if (!payout.getOrganizationId().equals(orgId)) {
            throw new org.springframework.security.access.AccessDeniedException("Unauthorized cross-tenant access");
        }

        payout.setApprovalStatus("APPROVED");
        payout.setApprovedBy(approvedBy);
        payout.setUpdatedAt(LocalDateTime.now());
        return payoutRepository.save(payout);
    }

    public ProviderPayout markPaid(String payoutId, String orgId) {
        ProviderPayout payout = payoutRepository.findById(payoutId)
                .orElseThrow(() -> new IllegalArgumentException("Payout not found: " + payoutId));
        if (!payout.getOrganizationId().equals(orgId)) {
            throw new org.springframework.security.access.AccessDeniedException("Unauthorized cross-tenant access");
        }

        payout.setApprovalStatus("PAID");
        payout.setPaidAt(LocalDateTime.now());
        payout.setUpdatedAt(LocalDateTime.now());
        return payoutRepository.save(payout);
    }

    public List<ProviderPayout> getPayoutsByOrg(String orgId) {
        return payoutRepository.findByOrganizationId(orgId);
    }

    public List<ProviderPayout> getPayoutsByProvider(String providerId) {
        return payoutRepository.findByProviderId(providerId);
    }

    public void deleteRate(String id, String orgId) {
        ProviderPaymentRate rate = rateRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Rate config not found: " + id));
        if (!rate.getOrganizationId().equals(orgId)) {
            throw new org.springframework.security.access.AccessDeniedException("Unauthorized cross-tenant access");
        }
        rateRepository.delete(rate);
    }

    public void deletePayout(String id, String orgId) {
        ProviderPayout payout = payoutRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Payout not found with ID: " + id));
        if (!payout.getOrganizationId().equals(orgId)) {
            throw new org.springframework.security.access.AccessDeniedException("Unauthorized cross-tenant access");
        }
        if ("PAID".equals(payout.getApprovalStatus())) {
            throw new IllegalStateException("Cannot delete a payout that has already been PAID.");
        }

        // Unlock associated shift logs (null-safe lineItems)
 
        List<PayoutLineItem> lineItems = payout.getLineItems() != null ? payout.getLineItems() : java.util.Collections.emptyList();
        List<String> sourceRefIds = lineItems.stream()
                .map(PayoutLineItem::getSourceRefId)
                .filter(ref -> ref != null)
                .collect(Collectors.toList());

        if (!sourceRefIds.isEmpty()) {
            Query query = new Query(Criteria.where("sourceRefId").in(sourceRefIds).and("status").is("LOCKED"));
            Update update = new Update().set("status", "CLOSED");
            mongoTemplate.updateMulti(query, update, ProviderShiftLog.class);
        }

        payoutRepository.delete(payout);
    }

    public ProviderShiftLog clockIn(String providerId, String orgId) {
        Optional<ProviderShiftLog> existing = shiftLogRepository.findByProviderIdAndOrganizationIdAndStatus(providerId, orgId, "OPEN")
                .stream().findFirst();
        if (existing.isPresent()) {
            return existing.get();
        }

        ProviderShiftLog openShift = ProviderShiftLog.builder()
                .providerId(providerId)
                .shiftStart(LocalDateTime.now())
                .status("OPEN")
                .sourceType("MANUAL")
                .organizationId(orgId)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
        return shiftLogRepository.save(openShift);
    }

    public ProviderShiftLog clockOut(String providerId, String orgId) {
        ProviderShiftLog openShift = shiftLogRepository.findByProviderIdAndOrganizationIdAndStatus(providerId, orgId, "OPEN")
                .stream().findFirst()
                .orElseThrow(() -> new IllegalStateException("No active clocked-in shift found for provider: " + providerId + " in org: " + orgId));

        LocalDateTime end = LocalDateTime.now();
        LocalDateTime start = openShift.getShiftStart() != null ? openShift.getShiftStart() : end;
        double hours = java.time.Duration.between(start, end).toMinutes() / 60.0;

        openShift.setShiftEnd(end);
        openShift.setHoursWorked(hours);
        openShift.setStatus("CLOSED");
        openShift.setUpdatedAt(LocalDateTime.now());
        return shiftLogRepository.save(openShift);
    }

    public ProviderShiftLog clockOut(String providerId) {
        return clockOut(providerId, TenantContext.currentOrganizationId());
    }

    public ProviderShiftLog logManualShift(String providerId, LocalDateTime start, LocalDateTime end, String orgId) {
        if (start == null || end == null) {
            throw new IllegalArgumentException("Shift start and end times must not be null.");
        }
        if (!end.isAfter(start)) {
            throw new IllegalArgumentException("Shift end time must be after start time.");
        }
        double hours = java.time.Duration.between(start, end).toMinutes() / 60.0;
        ProviderShiftLog shift = ProviderShiftLog.builder()
                .providerId(providerId)
                .shiftStart(start)
                .shiftEnd(end)
                .hoursWorked(hours)
                .status("CLOSED")
                .sourceType("MANUAL")
                .sourceRefId("MANUAL-" + java.util.UUID.randomUUID().toString().substring(0, 8))
                .organizationId(orgId)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
        return shiftLogRepository.save(shift);
    }

    public void deleteShiftLog(String id, String orgId) {
        ProviderShiftLog shift = shiftLogRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Shift log not found with ID: " + id));
        if (!shift.getOrganizationId().equals(orgId)) {
            throw new org.springframework.security.access.AccessDeniedException("Unauthorized cross-tenant access");
        }
        if ("LOCKED".equals(shift.getStatus())) {
            throw new IllegalStateException("Cannot delete a shift log that has already been locked in a payroll payout.");
        }
        shiftLogRepository.delete(shift);
    }
}
