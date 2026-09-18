package com.healthcare.epcr.reports.scheduler;

import com.healthcare.epcr.reports.service.PatientAnalyticsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class PatientAnalyticsReconciliationJob {

    private final PatientAnalyticsService patientAnalyticsService;

    @Scheduled(cron = "0 0 * * * *") // every hour
    public void run() {
        log.info("Triggering scheduled Patient Analytics counter reconciliation...");
        patientAnalyticsService.reconcileCounters();
    }
}
