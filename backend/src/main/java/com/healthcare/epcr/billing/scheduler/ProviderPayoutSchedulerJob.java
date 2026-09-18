package com.healthcare.epcr.billing.scheduler;

import com.healthcare.epcr.billing.model.ProviderPaymentRate;
import com.healthcare.epcr.billing.repository.ProviderPaymentRateRepository;
import com.healthcare.epcr.billing.service.ProviderPayoutService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class ProviderPayoutSchedulerJob {

    private final ProviderPaymentRateRepository rateRepository;
    private final ProviderPayoutService payoutService;

    /**
     * Runs automatically on 1st and 15th of every month at 2 AM.
     */
    @Scheduled(cron = "${billing.payout.scheduler.cron:0 0 2 1,15 * *}")
    public void runPayrollProcessing() {
        log.info("[ProviderPayoutScheduler] Starting automated payroll processing...");
        
        List<ProviderPaymentRate> activeRates = rateRepository.findAll().stream()
                .filter(r -> r.getActive() != null && r.getActive())
                .collect(java.util.stream.Collectors.toList());

        LocalDate end = LocalDate.now().minusDays(1);
        LocalDate start = end.minusDays(14); // 2-week period

        int processed = 0;
        int skipped = 0;

        for (ProviderPaymentRate rate : activeRates) {
            try {
                payoutService.generatePayout(rate.getProviderId(), start, end, rate.getOrganizationId());
                processed++;
            } catch (IllegalStateException e) {
                log.debug("[ProviderPayoutScheduler] Skipped provider {} - {}", rate.getProviderId(), e.getMessage());
                skipped++;
            } catch (Exception e) {
                log.error("[ProviderPayoutScheduler] Failed to process payroll for provider ID: {}", rate.getProviderId(), e);
                skipped++;
            }
        }

        log.info("[ProviderPayoutScheduler] Completed automated payroll: {} processed, {} skipped.", processed, skipped);
    }
}
