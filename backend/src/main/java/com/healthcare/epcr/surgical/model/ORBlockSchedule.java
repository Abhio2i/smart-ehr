package com.healthcare.epcr.surgical.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/**
 * ORBlockSchedule — recurring block reservation for a surgeon on a specific OR.
 * Mirrors ProviderScheduleTemplate pattern (same day-of-week + effectiveFrom/To logic).
 *
 * Example: Dr. Patel has General Surgery block every Tuesday 08:00–12:00 in OR-2.
 */
@Document(collection = "orBlockSchedules")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ORBlockSchedule {

    @Id
    private String id;

    @Indexed
    private String organizationId;

    @Indexed
    private String facilityId;

    /** The OR this block is reserved on. */
    @Indexed
    private String orId;

    /** Surgeon this block belongs to. */
    @Indexed
    private String surgeonId;

    /** Human-readable surgeon name (denormalized for board reads). */
    private String surgeonName;

    /** Day of week this block recurs. */
    private DayOfWeek dayOfWeek;

    private LocalTime startTime;
    private LocalTime endTime;

    /** Surgical specialty, e.g. "GENERAL_SURGERY", "ORTHOPAEDICS", "CARDIAC" */
    private String specialty;

    /** When this block template becomes effective. */
    private LocalDate effectiveFrom;

    /** Null = indefinite. */
    private LocalDate effectiveTo;

    /** Dates excluded from recurrence (holidays, leave). */
    private List<LocalDate> exceptionDates;

    private boolean active;

    private Instant createdAt;
    private Instant updatedAt;
}
