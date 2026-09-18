package com.healthcare.epcr.waitlist.scheduler;

import com.healthcare.epcr.waitlist.service.WaitlistService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Scheduled job that sweeps for expired waitlist slot offers and re-queues patients.
 *
 * Pattern: Identical to FollowUpScheduler — @Scheduled + service method delegation.
 * Offer expiry means: status=OFFERED AND offerExpiresAt < now
 * Action: status reset to WAITING, slot freed to OPEN, next patient offered.
 *
 * Runs every 5 minutes (configurable via waitlist.expiry.cron).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class WaitlistExpiryScheduler {

    private final WaitlistService waitlistService;

    @Scheduled(cron = "${waitlist.expiry.cron:0 */5 * * * *}")
    public void processExpiredOffers() {
        log.debug("[WaitlistExpiryScheduler] Running expired offer sweep...");
        try {
            waitlistService.processExpiredOffers();
        } catch (Exception e) {
            log.error("[WaitlistExpiryScheduler] Sweep failed: {}", e.getMessage(), e);
        }
    }
}
