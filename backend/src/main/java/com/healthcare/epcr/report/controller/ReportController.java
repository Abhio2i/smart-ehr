package com.healthcare.epcr.report.controller;

import com.healthcare.epcr.report.service.ReportService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {
    private final ReportService reportService;

    @GetMapping("/statistics")
    public ResponseEntity<Map<String, Object>> getStatistics() {
        return ResponseEntity.ok(reportService.getStatistics());
    }

    @GetMapping("/records-by-status")
    public ResponseEntity<Map<String, Object>> getRecordsByStatus() {
        return ResponseEntity.ok(reportService.getRecordsByStatus());
    }

    @GetMapping("/qa-performance")
    public ResponseEntity<Map<String, Object>> getQAPerformance() {
        return ResponseEntity.ok(reportService.getQAPerformance());
    }

    @GetMapping("/custom")
    public ResponseEntity<Map<String, Object>> generateCustomReport(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        LocalDateTime parsedStartDate = parseDateTime(startDate);
        LocalDateTime parsedEndDate = parseDateTime(endDate);

        Map<String, Object> report = reportService.generateCustomReport(parsedStartDate, parsedEndDate);
        if (startDate != null) {
            report.put("requestedStartDate", startDate);
        }
        if (endDate != null) {
            report.put("requestedEndDate", endDate);
        }
        return ResponseEntity.ok(report);
    }

    private LocalDateTime parseDateTime(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = URLDecoder.decode(value, StandardCharsets.UTF_8)
                .trim()
                .replace("\"", "");
        if (normalized.matches("^\\d{13}$")) {
            return LocalDateTime.ofInstant(Instant.ofEpochMilli(Long.parseLong(normalized)), ZoneOffset.UTC);
        }
        if (normalized.matches("^\\d{10}$")) {
            return LocalDateTime.ofInstant(Instant.ofEpochSecond(Long.parseLong(normalized)), ZoneOffset.UTC);
        }
        try {
            return Instant.parse(normalized).atOffset(ZoneOffset.UTC).toLocalDateTime();
        } catch (Exception ignored) {
            // try next format
        }
        try {
            return OffsetDateTime.parse(normalized).toLocalDateTime();
        } catch (Exception ignored) {
            // try next format
        }
        try {
            return LocalDateTime.parse(normalized);
        } catch (Exception ignored) {
            // try next format
        }
        try {
            return LocalDate.parse(normalized).atStartOfDay();
        } catch (Exception ignored) {
            throw new IllegalArgumentException("Invalid datetime format: " + value);
        }
    }


    @GetMapping("/dashboard-metrics")
    public ResponseEntity<Map<String, Object>> getDashboardMetrics() {
        return ResponseEntity.ok(reportService.getDashboardMetrics());
    }
}


