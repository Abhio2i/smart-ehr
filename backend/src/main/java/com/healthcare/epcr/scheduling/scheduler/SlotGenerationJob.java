package com.healthcare.epcr.scheduling.scheduler;

import com.healthcare.epcr.scheduling.model.AppointmentSlot;
import com.healthcare.epcr.scheduling.model.ProviderScheduleTemplate;
import com.healthcare.epcr.scheduling.repository.AppointmentSlotRepository;
import com.healthcare.epcr.scheduling.repository.ProviderScheduleTemplateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class SlotGenerationJob {

    private final ProviderScheduleTemplateRepository templateRepository;
    private final AppointmentSlotRepository slotRepository;

    @org.springframework.beans.factory.annotation.Autowired
    @org.springframework.context.annotation.Lazy
    private com.healthcare.epcr.waitlist.service.WaitlistService waitlistService;

    /** Nightly job — runs at 02:00 AM every day */
    @Scheduled(cron = "0 0 2 * * *")
    public void generateSlots() {
        log.info("Starting nightly appointment slot generation job...");
        generateSlotsForHorizon(60);
    }

    /**
     * Generate slots for ALL active templates for the next N days.
     * Called by the admin /generate-slots endpoint.
     */
    public void generateSlotsForHorizon(int daysAhead) {
        List<ProviderScheduleTemplate> templates = templateRepository.findByActiveTrue();
        LocalDate today   = LocalDate.now();
        LocalDate horizon = today.plusDays(daysAhead);

        int totalGenerated = 0;
        for (ProviderScheduleTemplate template : templates) {
            totalGenerated += generateSlotsForTemplate(template, today, horizon);
        }
        log.info("Nightly slot generation done — {} new slots created.", totalGenerated);
    }

    /**
     * Generate slots for ONE specific template over a custom date range.
     * Called from the UI "Generate" button via POST /templates/{id}/generate.
     *
     * @param template  the schedule template to use
     * @param from      start date (inclusive)
     * @param to        end date (inclusive)
     * @return number of slots actually created (duplicates skipped)
     */
    public int generateSlotsForTemplate(ProviderScheduleTemplate template,
                                        LocalDate from, LocalDate to) {
        int generated = 0;
        for (LocalDate date = from; !date.isAfter(to); date = date.plusDays(1)) {

            // 1. Check day-of-week matches template (either new workDays array or legacy dayOfWeek enum)
            if (template.getWorkDays() != null && !template.getWorkDays().isEmpty()) {
                int dayVal = date.getDayOfWeek().getValue() % 7; // 0=Sun, 1=Mon, ..., 6=Sat
                if (!template.getWorkDays().contains(dayVal)) {
                    continue;
                }
            } else if (template.getDayOfWeek() != null && date.getDayOfWeek() != template.getDayOfWeek()) {
                continue;
            }

            // 2. Skip exception dates (holiday / leave days)
            if (template.getExceptionDates() != null
                    && template.getExceptionDates().contains(date)) {
                log.debug("Skipping exception date {} for provider {}", date, template.getProviderId());
                continue;
            }

            // 3. Respect effective date boundaries
            LocalDate effFrom = template.getStartDate() != null ? template.getStartDate() : template.getEffectiveFrom();
            LocalDate effTo   = template.getEndDate() != null ? template.getEndDate() : template.getEffectiveTo();

            if (effFrom != null && date.isBefore(effFrom)) {
                continue;
            }
            if (effTo != null && date.isAfter(effTo)) {
                continue;
            }

            // 4. Skip if template is inactive
            if (!template.isActive()) {
                continue;
            }

            generated += generateSlotsForDay(template, date);
        }
        log.info("Generated {} slots for provider {} ({} → {})",
                generated, template.getProviderId(), from, to);
        return generated;
    }

    /**
     * Creates individual time slots for one day based on template start/end/duration.
     * Supports morning and afternoon split-shifts.
     */
    private int generateSlotsForDay(ProviderScheduleTemplate template, LocalDate date) {
        int count = 0;

        // 1. Generate morning session slots
        if (template.getMorningStart() != null && template.getMorningEnd() != null) {
            count += generateSlotsForTimeRange(template, date, template.getMorningStart(), template.getMorningEnd());
        }

        // 2. Generate afternoon session slots (if enabled)
        if (Boolean.TRUE.equals(template.getIncludeAfternoon()) 
                && template.getAfternoonStart() != null && template.getAfternoonEnd() != null) {
            count += generateSlotsForTimeRange(template, date, template.getAfternoonStart(), template.getAfternoonEnd());
        }

        // 3. Legacy fallback to startTime/endTime if no split-shift times are configured
        if (count == 0 && template.getStartTime() != null && template.getEndTime() != null) {
            count += generateSlotsForTimeRange(template, date, template.getStartTime(), template.getEndTime());
        }

        return count;
    }

    private int generateSlotsForTimeRange(ProviderScheduleTemplate template, LocalDate date, 
                                          LocalTime start, LocalTime end) {
        if (start == null || end == null || template.getSlotDurationMinutes() <= 0) {
            return 0;
        }

        LocalTime cursor = start;
        int created = 0;
        Instant now = Instant.now();

        while (!cursor.plusMinutes(template.getSlotDurationMinutes()).isAfter(end)) {
            Instant slotStart = date.atTime(cursor).atZone(ZoneId.systemDefault()).toInstant();
            Instant slotEnd   = date.atTime(cursor.plusMinutes(template.getSlotDurationMinutes()))
                                    .atZone(ZoneId.systemDefault()).toInstant();

            // Skip slots whose start time has already passed
            if (slotStart.isBefore(now)) {
                cursor = cursor.plusMinutes(template.getSlotDurationMinutes());
                continue;
            }

            AppointmentSlot slot = new AppointmentSlot();
            slot.setProviderId(template.getProviderId());
            slot.setOrganizationId(template.getOrganizationId());
            slot.setFacilityId(template.getFacilityId());
            slot.setSlotStart(slotStart);
            slot.setSlotEnd(slotEnd);
            slot.setStatus("OPEN");

            try {
                slotRepository.save(slot);
                created++;

                // Trigger waitlist slot offering — only for future slots (already guaranteed above)
                if (waitlistService != null && template.getAppointmentType() != null) {
                    try {
                        waitlistService.offerNextSlot(
                                slot.getOrganizationId(),
                                slot.getFacilityId(),
                                template.getAppointmentType().toUpperCase(),
                                slot.getId()
                        );
                    } catch (Exception ex) {
                        log.warn("[Waitlist] Failed to offer newly generated slot: {}", ex.getMessage());
                    }
                }
            } catch (DuplicateKeyException e) {
                // Compound index prevents duplicates — silently skip
            } catch (Exception e) {
                log.error("Failed to save slot for provider {} at {} {}: {}",
                        template.getProviderId(), date, cursor, e.getMessage());
            }

            cursor = cursor.plusMinutes(template.getSlotDurationMinutes());
        }
        return created;
    }

    /**
     * Automatic cleanup job that runs every 5 minutes.
     * Deletes any OPEN appointment slot where the start time is in the past.
     */
    @Scheduled(cron = "0 */5 * * * *")
    public void deleteExpiredOpenSlots() {
        Instant now = Instant.now();
        log.info("Running automatic slot cleanup job for expired open slots before {}", now);
        try {
            slotRepository.deleteByStatusAndSlotStartBefore("OPEN", now);
        } catch (Exception e) {
            log.error("Failed to delete expired open slots: {}", e.getMessage());
        }
    }

}

