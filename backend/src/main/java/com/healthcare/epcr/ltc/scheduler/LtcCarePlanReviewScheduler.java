package com.healthcare.epcr.ltc.scheduler;

import com.healthcare.epcr.ltc.entity.LtcResident;
import com.healthcare.epcr.ltc.repository.LtcResidentRepository;
import com.healthcare.epcr.notification.model.Notification;
import com.healthcare.epcr.notification.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Slf4j
@Component
@RequiredArgsConstructor
public class LtcCarePlanReviewScheduler {

    private final LtcResidentRepository residentRepository;
    private final NotificationRepository notificationRepository;

    /**
     * Daily background job at 08:30 AM to identify residents whose 90-day Supportive Pathways care plan is due for review within 7 days.
     */
    @Scheduled(cron = "0 30 8 * * *")
    public void checkForCarePlanReviews() {
        log.info("Running daily LTC care plan 90-day review check...");
        LocalDateTime sevenDaysOut = LocalDateTime.now().plusDays(7);

        residentRepository.findAll().stream()
            .filter(r -> r.getStatus() == LtcResident.ResidentStatus.ACTIVE || r.getStatus() == LtcResident.ResidentStatus.ADMITTED)
            .filter(r -> r.getCarePlan() != null && r.getCarePlan().getNextReviewDue() != null)
            .filter(r -> r.getCarePlan().getNextReviewDue().isBefore(sevenDaysOut))
            .forEach(r -> {
                Notification n = new Notification();
                n.setRecipientId("ALL_CLINICAL_STAFF");
                n.setType("WARNING");
                n.setTitle("LTC Care Plan Review Due");
                n.setMessage("Supportive Pathways Care Plan for resident " + r.getPatientId() + " (Bed: " + (r.getBedId() != null ? r.getBedId() : "Unassigned") + ") is due for 90-day review on " + r.getCarePlan().getNextReviewDue().toLocalDate());
                n.setRelatedEntityId(r.getId());
                n.setRelatedEntityType("LTC_RESIDENT");
                n.setRead(false);
                n.setCreatedAt(LocalDateTime.now());
                try {
                    notificationRepository.save(n);
                } catch (Exception e) {
                    log.warn("Could not persist care plan review notification: {}", e.getMessage());
                }
            });
    }
}
