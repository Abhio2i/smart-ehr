package com.healthcare.epcr.common.util;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

public class DateUtils {
    private static final DateTimeFormatter ISO_FORMATTER = DateTimeFormatter.ISO_DATE_TIME;
    private static final DateTimeFormatter SIMPLE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    public static String formatToISO(LocalDateTime dateTime) {
        return dateTime != null ? dateTime.format(ISO_FORMATTER) : null;
    }

    public static String formatToSimple(LocalDateTime dateTime) {
        return dateTime != null ? dateTime.format(SIMPLE_FORMATTER) : null;
    }

    public static LocalDateTime parseISO(String dateString) {
        return LocalDateTime.parse(dateString, ISO_FORMATTER);
    }

    public static LocalDateTime parseSimple(String dateString) {
        return LocalDateTime.parse(dateString, SIMPLE_FORMATTER);
    }

    public static boolean isWithinRange(LocalDateTime date, LocalDateTime start, LocalDateTime end) {
        return date != null && (date.isEqual(start) || date.isAfter(start)) &&
                (date.isEqual(end) || date.isBefore(end));
    }

    public static long getDaysBetween(LocalDateTime start, LocalDateTime end) {
        return java.time.temporal.ChronoUnit.DAYS.between(start, end);
    }
}


