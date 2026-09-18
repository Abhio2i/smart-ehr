package com.healthcare.epcr.security.session.scheduler;

import com.healthcare.epcr.security.session.repository.UserSessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * Nightly cleanup job that removes stale session records from MongoDB.
 *
 * <p>Without this, the {@code user_sessions} collection grows indefinitely because
 * revoked / expired sessions are soft-deleted (active=false) but never purged.
 *
 * <p>Strategy:
 * <ul>
 *   <li>Delete sessions whose {@code expiresAt} is in the past (hard-expired).</li>
 *   <li>Delete inactive (revoked) sessions older than 7 days as a safety net.</li>
 * </ul>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SessionCleanupScheduler {

    private final UserSessionRepository userSessionRepository;

    /**
     * Runs on the schedule defined by SESSION_CLEANUP_CRON (default: every day at 02:00 AM).
     * Configurable per environment without code changes — just update the env var.
     * Format: "second minute hour day month weekday"
     */
    @Scheduled(cron = "${session.cleanup.cron:0 0 2 * * *}")
    public void cleanupExpiredSessions() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime retentionCutoff = now.minusDays(7);

        // 1. Hard-expired sessions (expiresAt is in the past)
        long expiredCount = userSessionRepository.deleteByExpiresAtBefore(now);

        // 2. Old revoked/inactive sessions beyond the 7-day retention window
        long revokedCount = userSessionRepository.deleteByActiveFalseAndRevokedAtBefore(retentionCutoff);

        log.info("Session cleanup complete — removed {} hard-expired, {} old-revoked sessions", expiredCount, revokedCount);
    }
}
