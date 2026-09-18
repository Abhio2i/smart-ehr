package com.healthcare.epcr.homecare.util;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * FrequencyParser — converts human-readable frequency strings to visit dates.
 *
 * Supported formats:
 *   "daily"           → every day
 *   "twice daily"     → every day (one visit per day recorded)
 *   "weekly"          → once a week (same weekday as startDate)
 *   "twice weekly"    → Tue + Fri
 *   "3x/week"         → Mon, Wed, Fri
 *   "every 48 hours"  → every other day
 *   "every 72 hours"  → every 3 days
 *   "monthly"         → once a month (same date as startDate)
 */
@Component
@Slf4j
public class FrequencyParser {

    /**
     * Returns visit dates for the NEXT 7 days (from tomorrow) that match the frequency.
     * @param frequency  human-readable string (case-insensitive)
     * @param startDate  referral start date — used as anchor for weekday/interval calculations
     * @return ordered list of LocalDates (may be empty)
     */
    public List<LocalDate> resolveNext7Days(String frequency, LocalDate startDate) {
        if (frequency == null || frequency.isBlank()) {
            return List.of();
        }

        String normalized = frequency.trim().toLowerCase();
        LocalDate today = LocalDate.now();
        List<LocalDate> result = new ArrayList<>();

        for (int i = 1; i <= 7; i++) {
            LocalDate candidate = today.plusDays(i);
            if (!candidate.isBefore(startDate) && matchesFrequency(normalized, candidate, startDate)) {
                result.add(candidate);
            }
        }

        return result;
    }

    /**
     * Check if a specific date matches the frequency pattern.
     */
    public boolean matchesFrequency(String normalized, LocalDate candidate, LocalDate startDate) {
        switch (normalized) {
            case "daily":
            case "twice daily":
            case "every day":
                return true;

            case "weekly":
                // Same day of week as startDate
                return candidate.getDayOfWeek() == startDate.getDayOfWeek();

            case "twice weekly":
                // Tuesday and Friday
                return candidate.getDayOfWeek() == DayOfWeek.TUESDAY
                        || candidate.getDayOfWeek() == DayOfWeek.FRIDAY;

            case "3x/week":
            case "3 times a week":
            case "3 times per week":
                // Monday, Wednesday, Friday
                return candidate.getDayOfWeek() == DayOfWeek.MONDAY
                        || candidate.getDayOfWeek() == DayOfWeek.WEDNESDAY
                        || candidate.getDayOfWeek() == DayOfWeek.FRIDAY;

            case "2x/week":
            case "2 times a week":
                return candidate.getDayOfWeek() == DayOfWeek.TUESDAY
                        || candidate.getDayOfWeek() == DayOfWeek.THURSDAY;

            case "every 48 hours":
            case "every other day":
                // Even/odd day offset from startDate
                long dayOffset = java.time.temporal.ChronoUnit.DAYS.between(startDate, candidate);
                return dayOffset >= 0 && dayOffset % 2 == 0;

            case "every 72 hours":
            case "every 3 days":
                long offset3 = java.time.temporal.ChronoUnit.DAYS.between(startDate, candidate);
                return offset3 >= 0 && offset3 % 3 == 0;

            case "monthly":
                return candidate.getDayOfMonth() == startDate.getDayOfMonth();

            default:
                // Try to parse "Nx/week" pattern dynamically  e.g. "4x/week"
                if (normalized.matches("\\d+x/week")) {
                    int timesPerWeek = Integer.parseInt(normalized.replaceAll("[^0-9]", ""));
                    return isNthDayOfWeek(candidate, timesPerWeek);
                }
                log.warn("[FrequencyParser] Unknown frequency pattern: '{}'. Defaulting to daily.", normalized);
                return true;
        }
    }

    /**
     * Evenly distributes N visits across a 7-day week starting from Monday.
     * e.g. timesPerWeek=4 → Mon, Tue, Thu, Fri
     */
    private boolean isNthDayOfWeek(LocalDate date, int timesPerWeek) {
        // Pick the first N weekdays (Mon=1 through Sun=7)
        List<DayOfWeek> selected = new ArrayList<>();
        DayOfWeek[] all = DayOfWeek.values();
        int step = 7 / timesPerWeek;
        for (int i = 0; i < timesPerWeek; i++) {
            selected.add(all[(i * step) % 7]);
        }
        return selected.contains(date.getDayOfWeek());
    }
}
