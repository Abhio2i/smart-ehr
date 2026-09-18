package com.healthcare.epcr.followup.scheduler;

import com.healthcare.epcr.followup.service.FollowUpTaskService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

@Component
@RequiredArgsConstructor
@Slf4j
public class FollowUpScheduler {

    private final FollowUpTaskService followUpTaskService;

    @EventListener(ApplicationReadyEvent.class)
    public void backfillOnStartup() {
        int created = followUpTaskService.backfillMissingTasks();
        log.info("Critical follow-up startup backfill created {} task(s)", created);
    }

    @Scheduled(cron = "${followup.scheduler.cron:0 0 8 * * *}", zone = "${followup.scheduler.zone:Asia/Kolkata}")
    public void runDailyFollowUps() {
        int created = followUpTaskService.backfillMissingTasks();
        int sent = followUpTaskService.sendDueFollowUps(LocalDate.now());
        log.info("Critical follow-up scheduler completed. backfilled={}, sent={}", created, sent);
    }
}
