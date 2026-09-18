package com.healthcare.epcr.scheduling.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@Data
@Document(collection = "provider_schedule_templates")
public class ProviderScheduleTemplate {
    @Id
    private String id;
    private String organizationId;
    private String providerId;
    private String facilityId;
    private DayOfWeek dayOfWeek;
    private LocalTime startTime;
    private LocalTime endTime;
    private int slotDurationMinutes;
    private LocalDate effectiveFrom;   // when the schedule template begins
    private LocalDate effectiveTo;     // null = indefinite schedule
    private List<LocalDate> exceptionDates; // dates when provider is not available
    private boolean active;

    // Frontend-specific grouped fields for multi-day split-shift scheduling
    private String specialty;
    private String appointmentType;
    private String location;
    private List<Integer> workDays;      // 0=Sun, 1=Mon, ..., 6=Sat
    private LocalTime morningStart;
    private LocalTime morningEnd;
    private LocalTime afternoonStart;
    private LocalTime afternoonEnd;
    private Boolean includeAfternoon;
    private LocalDate startDate;        // mapped from form.startDate
    private LocalDate endDate;          // mapped from form.endDate
}

