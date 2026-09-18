package com.healthcare.epcr.scheduling.scheduler;

import com.healthcare.epcr.scheduling.model.Appointment;
import com.healthcare.epcr.scheduling.repository.AppointmentRepository;
import com.healthcare.epcr.notification.model.Notification;
import com.healthcare.epcr.notification.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class AppointmentReminderJob {

    private final AppointmentRepository appointmentRepository;
    private final NotificationRepository notificationRepository;

    @Scheduled(cron = "0 */15 * * * *") // Runs every 15 minutes
    public void sendUpcomingReminders() {
        log.info("Checking for upcoming appointments to send reminders...");
        Instant now = Instant.now();
        Instant windowStart = now.plus(24, ChronoUnit.HOURS);
        Instant windowEnd = windowStart.plus(15, ChronoUnit.MINUTES);

        List<Appointment> upcoming = appointmentRepository
                .findByStatusAndScheduledStartBetweenAndReminderSentFalse("SCHEDULED", windowStart, windowEnd);

        int count = 0;
        for (Appointment appt : upcoming) {
            // 1. Send notification to Patient
            Notification patientNotif = new Notification();
            patientNotif.setRecipientId(appt.getPatientId());
            patientNotif.setType("INFO");
            patientNotif.setTitle("Upcoming Appointment Reminder");
            patientNotif.setMessage("You have an upcoming appointment scheduled on " 
                    + appt.getScheduledStart().toString() + ". Please arrive 15 minutes early.");
            patientNotif.setCreatedAt(LocalDateTime.now());
            patientNotif.setRead(false);
            notificationRepository.save(patientNotif);

            // 2. Send notification to Provider/Paramedic
            Notification providerNotif = new Notification();
            providerNotif.setRecipientId(appt.getProviderId());
            providerNotif.setType("INFO");
            providerNotif.setTitle("Upcoming Appointment Reminder");
            providerNotif.setMessage("Patient Care Appointment scheduled on " 
                    + appt.getScheduledStart().toString() + " for patient " + appt.getPatientId());
            providerNotif.setCreatedAt(LocalDateTime.now());
            providerNotif.setRead(false);
            notificationRepository.save(providerNotif);

            // 3. Mark reminder as sent
            appt.setReminderSent(true);
            appt.setUpdatedAt(Instant.now());
            appointmentRepository.save(appt);
            count++;
        }
        log.info("Sent reminders for {} upcoming appointments.", count);
    }
}
