package com.healthcare.epcr.chatbot.service;

import com.healthcare.epcr.patienthistory.service.PatientHistoryService;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class PatientAiToolService {

    private final PatientHistoryService patientHistoryService;
    private final ObjectMapper objectMapper;

    private final ThreadLocal<String> patientIdHolder = new ThreadLocal<>();

    public void setPatientId(String patientId) {
        this.patientIdHolder.set(patientId);
    }

    public String getPatientId() {
        return this.patientIdHolder.get();
    }

    public void clearPatientId() {
        this.patientIdHolder.remove();
    }

    @Tool(description = """
        Fetch the patient's health summary: active conditions, current medications,
        allergies, and DNR status. Use when the patient asks about their health,
        conditions, or what medications they are on.
        """)
    public String getHealthSummary() {
        String pid = getPatientId();
        try {
            return toJson(patientHistoryService.getSummary(pid));
        } catch (Exception e) {
            log.error("Tool error getHealthSummary pid={}", pid, e);
            return error("Could not retrieve your health summary right now.");
        }
    }

    @Tool(description = """
        Fetch the patient's most recent vital signs: heart rate, blood pressure,
        SpO2, temperature, GCS score, and respiratory rate.
        Use when the patient asks about their vitals or recent readings.
        """)
    public String getLatestVitals() {
        String pid = getPatientId();
        try {
            var vitals = patientHistoryService.getVitals(pid, null, null);
            return (vitals == null || vitals.isEmpty())
                    ? "{\"message\": \"No vitals have been recorded yet.\"}"
                    : toJson(vitals.get(0));
        } catch (Exception e) {
            log.error("Tool error getLatestVitals pid={}", pid, e);
            return error("Could not retrieve your vitals right now.");
        }
    }

    @Tool(description = """
        Fetch the patient's recent lab results: test name, value, unit,
        reference range, and date collected.
        Use when the patient asks about blood work, test results, or labs.
        """)
    public String getLabResults() {
        String pid = getPatientId();
        try {
            return toJson(patientHistoryService.getLabResults(pid));
        } catch (Exception e) {
            log.error("Tool error getLabResults pid={}", pid, e);
            return error("Could not retrieve your lab results right now.");
        }
    }

    @Tool(description = """
        Fetch the patient's hospital admissions history: admission date,
        discharge date, reason, and hospital name.
        Use when the patient asks about past hospital visits or admissions.
        """)
    public String getAdmissionsHistory() {
        String pid = getPatientId();
        try {
            return toJson(patientHistoryService.getAdmissions(pid));
        } catch (Exception e) {
            log.error("Tool error getAdmissionsHistory pid={}", pid, e);
            return error("Could not retrieve your admissions history right now.");
        }
    }

    @Tool(description = """
        Fetch the patient's uploaded health documents: document name, type,
        upload date, and notes. Does NOT return the file itself.
        Use when the patient asks what documents are on file for them.
        """)
    public String getDocumentsList() {
        String pid = getPatientId();
        try {
            return toJson(patientHistoryService.getDocuments(pid));
        } catch (Exception e) {
            log.error("Tool error getDocumentsList pid={}", pid, e);
            return error("Could not retrieve your documents right now.");
        }
    }

    @Tool(description = """
        Fetch vital sign readings over a time range.
        startDate and endDate must be ISO-8601 (e.g. 2025-01-01T00:00:00).
        Use when the patient asks about trends or history of their vitals
        over a specific period.
        """)
    public String getVitalsTrend(String startDate, String endDate) {
        String pid = getPatientId();
        try {
            LocalDateTime start = LocalDateTime.parse(startDate);
            LocalDateTime end = LocalDateTime.parse(endDate);
            return toJson(patientHistoryService.getVitals(pid, start, end));
        } catch (Exception e) {
            log.error("Tool error getVitalsTrend pid={}", pid, e);
            return error("Could not retrieve your vitals history right now.");
        }
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            return error("Data formatting error.");
        }
    }

    private String error(String message) {
        return "{\"error\": \"" + message + "\"}";
    }
}
