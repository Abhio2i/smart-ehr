package com.healthcare.epcr.report.service;

import com.healthcare.epcr.epcr.repository.PatientCareRecordRepository;
import com.healthcare.epcr.phi.crypto.PhiCryptoService;
import com.healthcare.epcr.qa.repository.QAReviewRepository;
import com.healthcare.epcr.security.AccessControlService;
import com.healthcare.epcr.user.repository.UserRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import com.healthcare.epcr.epcr.enums.RecordStatus;

import lombok.RequiredArgsConstructor;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.LinkedHashMap;
import java.time.temporal.ChronoUnit;

@Service
@RequiredArgsConstructor
public class ReportService {
    private final PatientCareRecordRepository recordRepository;
    private final QAReviewRepository qaReviewRepository;
    private final AccessControlService accessControlService;
    private final PhiCryptoService phiCryptoService;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    public Map<String, Object> getStatistics() {
        var accessibleRecords = filterVisibleRecords(recordRepository.findAll());
        var accessibleRecordIds = accessibleRecords.stream().map(r -> r.getId()).collect(Collectors.toSet());
        var accessibleReviews = qaReviewRepository.findAll().stream()
                .filter(r -> accessibleRecordIds.contains(r.getPatientCareRecordId()))
                .toList();
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalRecords", accessibleRecords.size());
        stats.put("totalReviews", accessibleReviews.size());
        stats.put("draftRecords", accessibleRecords.stream().filter(r -> r.getStatus() == RecordStatus.DRAFT).count());
        stats.put("submittedRecords", accessibleRecords.stream().filter(r -> r.getStatus() == RecordStatus.SUBMITTED).count());
        stats.put("approvedRecords", accessibleRecords.stream().filter(r -> r.getStatus() == RecordStatus.APPROVED).count());
        return stats;
    }

    public Map<String, Object> getRecordsByStatus() {
        var accessibleRecords = filterVisibleRecords(recordRepository.findAll());
        Map<String, Object> data = new HashMap<>();
        data.put("draft", accessibleRecords.stream().filter(r -> r.getStatus() == RecordStatus.DRAFT).count());
        data.put("inProgress", accessibleRecords.stream().filter(r -> r.getStatus() == RecordStatus.IN_PROGRESS).count());
        data.put("completed", accessibleRecords.stream().filter(r -> r.getStatus() == RecordStatus.COMPLETED).count());
        data.put("submitted", accessibleRecords.stream().filter(r -> r.getStatus() == RecordStatus.SUBMITTED).count());
        data.put("approved", accessibleRecords.stream().filter(r -> r.getStatus() == RecordStatus.APPROVED).count());
        data.put("rejected", accessibleRecords.stream().filter(r -> r.getStatus() == RecordStatus.REJECTED).count());
        return data;
    }

    public Map<String, Object> getQAPerformance() {
        var accessibleRecordIds = filterVisibleRecords(recordRepository.findAll()).stream()
                .map(r -> r.getId())
                .collect(Collectors.toSet());
        var accessibleReviews = qaReviewRepository.findAll().stream()
                .filter(r -> accessibleRecordIds.contains(r.getPatientCareRecordId()))
                .toList();
        Map<String, Object> data = new HashMap<>();
        data.put("totalReviews", accessibleReviews.size());
        data.put("passedReviews", accessibleReviews.stream().filter(r -> Boolean.TRUE.equals(r.getPassed())).count());
        data.put("failedReviews", accessibleReviews.stream().filter(r -> Boolean.FALSE.equals(r.getPassed())).count());
        data.put("pendingReviews", accessibleReviews.stream().filter(r -> "PENDING".equalsIgnoreCase(r.getStatus()) || "QA_PENDING".equalsIgnoreCase(r.getStatus())).count());
        return data;
    }

    public Map<String, Object> generateCustomReport(LocalDateTime startDate, LocalDateTime endDate) {
        if (startDate != null && endDate != null && startDate.isAfter(endDate)) {
            throw new IllegalArgumentException("startDate must be before or equal to endDate");
        }

        var scopedRecords = filterByDateRange(filterVisibleRecords(recordRepository.findAll()), startDate, endDate);
        var scopedRecordIds = scopedRecords.stream().map(r -> r.getId()).collect(Collectors.toSet());
        var scopedReviews = filterReviewsByDateRange(qaReviewRepository.findAll(), startDate, endDate).stream()
                .filter(r -> scopedRecordIds.contains(r.getPatientCareRecordId()))
                .toList();

        Map<String, Object> report = new HashMap<>();
        report.put("reportGeneratedAt", LocalDateTime.now());
        report.put("period", buildPeriodLabel(startDate, endDate));
        report.put("statistics", buildStatistics(scopedRecords, scopedReviews));
        report.put("recordsByStatus", buildRecordsByStatus(scopedRecords));
        report.put("qaPerformance", buildQaPerformance(scopedReviews));
        return report;
    }


    @Cacheable(value = "reports:dashboardMetrics", key = "@accessControlService.currentUser().id")
    public Map<String, Object> getDashboardMetrics() {
        var accessibleRecords = filterVisibleRecords(recordRepository.findAll());
        var accessibleRecordIds = accessibleRecords.stream().map(r -> r.getId()).collect(Collectors.toSet());
        var accessibleReviews = qaReviewRepository.findAll().stream()
                .filter(r -> accessibleRecordIds.contains(r.getPatientCareRecordId()))
                .toList();

        Map<String, Object> data = new HashMap<>();
        data.put("monthWiseQaPassRate", buildMonthWiseQaPassRate(accessibleReviews, 6));
        data.put("topIncidentLocations", buildTopIncidentLocations(accessibleRecords, 5));
        data.put("averageReviewTimeHours", computeAverageReviewTimeHours(accessibleReviews));
        return data;
    }

    private List<Map<String, Object>> buildMonthWiseQaPassRate(List<com.healthcare.epcr.qa.model.QAReview> reviews, int monthsBack) {
        YearMonth now = YearMonth.now();
        List<YearMonth> months = new ArrayList<>();
        for (int i = monthsBack - 1; i >= 0; i--) {
            months.add(now.minusMonths(i));
        }

        Map<YearMonth, List<com.healthcare.epcr.qa.model.QAReview>> grouped = reviews.stream()
                .filter(r -> r.getCompletedAt() != null)
                .collect(Collectors.groupingBy(r -> YearMonth.from(r.getCompletedAt())));

        List<Map<String, Object>> output = new ArrayList<>();
        for (YearMonth ym : months) {
            List<com.healthcare.epcr.qa.model.QAReview> monthReviews = grouped.getOrDefault(ym, List.of());
            long total = monthReviews.size();
            long passed = monthReviews.stream().filter(r -> Boolean.TRUE.equals(r.getPassed())).count();
            double passRate = total == 0 ? 0.0 : (passed * 100.0) / total;

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("month", ym.toString());
            row.put("totalReviews", total);
            row.put("passedReviews", passed);
            row.put("passRate", Math.round(passRate * 100.0) / 100.0);
            output.add(row);
        }
        return output;
    }

    private List<Map<String, Object>> buildTopIncidentLocations(List<com.healthcare.epcr.epcr.model.PatientCareRecord> records, int topN) {
        Map<String, Long> counts = records.stream()
                .map(r -> {
                    String loc = phiCryptoService.decrypt(r.getIncidentLocation());
                    if (loc == null || loc.isBlank()) {
                        return "UNKNOWN";
                    }
                    loc = loc.trim();
                    if (loc.startsWith("enc::")) {
                        // Fallback if encrypted prefix remains
                        loc = "Location #" + Math.abs(loc.hashCode() % 1000);
                    }
                    return loc;
                })
                .collect(Collectors.groupingBy(v -> v, Collectors.counting()));

        return counts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue(Comparator.reverseOrder()))
                .limit(topN)
                .map(e -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("location", e.getKey());
                    row.put("count", e.getValue());
                    return row;
                })
                .toList();
    }

    private double computeAverageReviewTimeHours(List<com.healthcare.epcr.qa.model.QAReview> reviews) {
        List<Long> durations = reviews.stream()
                .filter(r -> r.getCreatedAt() != null && r.getCompletedAt() != null)
                .map(r -> ChronoUnit.MINUTES.between(r.getCreatedAt(), r.getCompletedAt()))
                .filter(minutes -> minutes >= 0)
                .toList();
        if (durations.isEmpty()) {
            return 0.0;
        }
        double avgMinutes = durations.stream().mapToLong(Long::longValue).average().orElse(0.0);
        return Math.round((avgMinutes / 60.0) * 100.0) / 100.0;
    }

    private List<com.healthcare.epcr.epcr.model.PatientCareRecord> filterVisibleRecords(
            List<com.healthcare.epcr.epcr.model.PatientCareRecord> records) {
        return records.stream()
                .filter(r -> accessControlService.canAccessOrganization(r.getOrganizationId()))
                .toList();
    }

    private List<com.healthcare.epcr.epcr.model.PatientCareRecord> filterByDateRange(
            List<com.healthcare.epcr.epcr.model.PatientCareRecord> records,
            LocalDateTime startDate,
            LocalDateTime endDate) {
        if (startDate == null && endDate == null) {
            return records;
        }
        return records.stream()
                .filter(r -> inRange(r.getCreatedAt(), startDate, endDate))
                .toList();
    }

    private List<com.healthcare.epcr.qa.model.QAReview> filterReviewsByDateRange(
            List<com.healthcare.epcr.qa.model.QAReview> reviews,
            LocalDateTime startDate,
            LocalDateTime endDate) {
        if (startDate == null && endDate == null) {
            return reviews;
        }
        return reviews.stream()
                .filter(r -> inRange(r.getCreatedAt(), startDate, endDate))
                .toList();
    }

    private boolean inRange(LocalDateTime value, LocalDateTime startDate, LocalDateTime endDate) {
        if (value == null) {
            return false;
        }
        if (startDate != null && value.isBefore(startDate)) {
            return false;
        }
        if (endDate != null && value.isAfter(endDate)) {
            return false;
        }
        return true;
    }

    private Map<String, Object> buildStatistics(
            List<com.healthcare.epcr.epcr.model.PatientCareRecord> records,
            List<com.healthcare.epcr.qa.model.QAReview> reviews) {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalRecords", records.size());
        stats.put("totalReviews", reviews.size());
        stats.put("draftRecords", records.stream().filter(r -> r.getStatus() == RecordStatus.DRAFT).count());
        stats.put("submittedRecords", records.stream().filter(r -> r.getStatus() == RecordStatus.SUBMITTED).count());
        stats.put("approvedRecords", records.stream().filter(r -> r.getStatus() == RecordStatus.APPROVED).count());
        return stats;
    }

    private Map<String, Object> buildRecordsByStatus(List<com.healthcare.epcr.epcr.model.PatientCareRecord> records) {
        Map<String, Object> data = new HashMap<>();
        data.put("draft", records.stream().filter(r -> r.getStatus() == RecordStatus.DRAFT).count());
        data.put("inProgress", records.stream().filter(r -> r.getStatus() == RecordStatus.IN_PROGRESS).count());
        data.put("completed", records.stream().filter(r -> r.getStatus() == RecordStatus.COMPLETED).count());
        data.put("submitted", records.stream().filter(r -> r.getStatus() == RecordStatus.SUBMITTED).count());
        data.put("approved", records.stream().filter(r -> r.getStatus() == RecordStatus.APPROVED).count());
        data.put("rejected", records.stream().filter(r -> r.getStatus() == RecordStatus.REJECTED).count());
        return data;
    }

    private Map<String, Object> buildQaPerformance(List<com.healthcare.epcr.qa.model.QAReview> reviews) {
        Map<String, Object> data = new HashMap<>();
        data.put("totalReviews", reviews.size());
        data.put("passedReviews", reviews.stream().filter(r -> Boolean.TRUE.equals(r.getPassed())).count());
        data.put("failedReviews", reviews.stream().filter(r -> Boolean.FALSE.equals(r.getPassed())).count());
        data.put("pendingReviews", reviews.stream().filter(r -> "PENDING".equalsIgnoreCase(r.getStatus()) || "QA_PENDING".equalsIgnoreCase(r.getStatus())).count());
        return data;
    }

    private String buildPeriodLabel(LocalDateTime startDate, LocalDateTime endDate) {
        if (startDate == null && endDate == null) {
            return "All Time";
        }
        return (startDate == null ? "..." : startDate.toString()) + " to " + (endDate == null ? "..." : endDate.toString());
    }

    private Map<String, Object> toDecryptedRecordMap(com.healthcare.epcr.epcr.model.PatientCareRecord record) {
        com.healthcare.epcr.epcr.model.PatientCareRecord decrypted = decryptRecord(record);
        Map<String, Object> raw = objectMapper.convertValue(decrypted, new TypeReference<Map<String, Object>>() {});
        return decryptMap(raw);
    }

    private com.healthcare.epcr.epcr.model.PatientCareRecord decryptRecord(com.healthcare.epcr.epcr.model.PatientCareRecord source) {
        com.healthcare.epcr.epcr.model.PatientCareRecord d = new com.healthcare.epcr.epcr.model.PatientCareRecord();
        d.setId(source.getId());
        d.setPatientId(source.getPatientId());
        d.setPatientName(phiCryptoService.decrypt(source.getPatientName()));
        d.setPatientDateOfBirth(phiCryptoService.decrypt(source.getPatientDateOfBirth()));
        d.setPatientGender(source.getPatientGender());
        d.setPatientPhone(phiCryptoService.decrypt(source.getPatientPhone()));
        d.setPatientAddress(phiCryptoService.decrypt(source.getPatientAddress()));
        d.setPatientSSNLast4(phiCryptoService.decrypt(source.getPatientSSNLast4()));
        d.setMedicalHistory(source.getMedicalHistory());
        d.setHeight(source.getHeight());
        d.setWeight(source.getWeight());
        d.setAge(source.getAge());
        d.setEmail(phiCryptoService.decrypt(source.getEmail()));
        d.setBloodGroup(phiCryptoService.decrypt(source.getBloodGroup()));
        d.setSpo2(source.getSpo2());
        d.setRespirationRate(source.getRespirationRate());
        d.setBloodSugar(source.getBloodSugar());
        d.setHeartRate(source.getHeartRate());
        d.setDiastolicBp(source.getDiastolicBp());
        d.setSystolicBp(source.getSystolicBp());
        d.setPulseRate(source.getPulseRate());
        d.setTemperature(source.getTemperature());
        d.setHemoglobin(source.getHemoglobin());
        d.setComorbidity(phiCryptoService.decrypt(source.getComorbidity()));
        d.setAllergy(phiCryptoService.decrypt(source.getAllergy()));
        d.setDoctor(phiCryptoService.decrypt(source.getDoctor()));
        d.setCurrentMedicines(phiCryptoService.decrypt(source.getCurrentMedicines()));
        d.setIncidentDateTime(source.getIncidentDateTime());
        d.setIncidentLocation(phiCryptoService.decrypt(source.getIncidentLocation()));
        d.setIncidentDescription(phiCryptoService.decrypt(source.getIncidentDescription()));
        d.setIncidentType(source.getIncidentType());
        d.setIncidentNumber(source.getIncidentNumber());
        d.setSceneAssessment(source.getSceneAssessment());
        d.setCrew(source.getCrew());
        d.setTimeline(source.getTimeline());
        d.setParamedicsId(formatIdWithName(source.getParamedicsId()));
        d.setOrganizationId(source.getOrganizationId());
        d.setComplaints(phiCryptoService.decryptList(source.getComplaints()));
        d.setVitals(phiCryptoService.decryptList(source.getVitals()));
        d.setStructuredComplaints(source.getStructuredComplaints());
        d.setStructuredVitals(source.getStructuredVitals());
        d.setDiagnosis(phiCryptoService.decrypt(source.getDiagnosis()));
        d.setTreatmentProvided(phiCryptoService.decrypt(source.getTreatmentProvided()));
        d.setTreatmentPlan(phiCryptoService.decrypt(source.getTreatmentPlan()));
        d.setTransportDestination(phiCryptoService.decrypt(source.getTransportDestination()));
        d.setTransportMode(source.getTransportMode());
        d.setCareLevel(source.getCareLevel());
        d.setIcd10Code(source.getIcd10Code());
        d.setPrimaryImpression(source.getPrimaryImpression());
        d.setSecondaryImpression(source.getSecondaryImpression());
        d.setMedicationsAdministered(phiCryptoService.decryptList(source.getMedicationsAdministered()));
        d.setProceduresPerformed(phiCryptoService.decryptList(source.getProceduresPerformed()));
        d.setStructuredMedications(source.getStructuredMedications());
        d.setStructuredProcedures(source.getStructuredProcedures());
        d.setTransport(source.getTransport());
        d.setConsent(source.getConsent());
        d.setClinicalData(source.getClinicalData());
        d.setStatus(source.getStatus());
        d.setCreatedAt(source.getCreatedAt());
        d.setUpdatedAt(source.getUpdatedAt());
        d.setSubmittedAt(source.getSubmittedAt());
        d.setSubmittedBy(formatIdWithName(source.getSubmittedBy()));
        d.setQaApproved(source.getQaApproved());
        d.setQaApprovedAt(source.getQaApprovedAt());
        d.setQaApprovedBy(formatIdWithName(source.getQaApprovedBy()));
        d.setAttachmentIds(source.getAttachmentIds());
        d.setAuditTrail(source.getAuditTrail());
        d.setFeedback(source.getFeedback());
        d.setDynamicFormResponses(source.getDynamicFormResponses());
        return d;
    }

    private String formatIdWithName(String userId) {
        if (userId == null || userId.isBlank()) {
            return userId;
        }
        String name = userRepository.findById(userId)
                .map(u -> ((u.getFirstName() == null ? "" : u.getFirstName()) + " "
                        + (u.getLastName() == null ? "" : u.getLastName())).trim())
                .filter(s -> !s.isBlank())
                .orElse(null);
        if (name == null) {
            return userId;
        }
        return userId + " (" + name + ")";
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> decryptMap(Map<String, Object> source) {
        Map<String, Object> output = new HashMap<>();
        for (Map.Entry<String, Object> entry : source.entrySet()) {
            output.put(entry.getKey(), decryptValue(entry.getValue()));
        }
        return output;
    }

    @SuppressWarnings("unchecked")
    private Object decryptValue(Object value) {
        if (value instanceof String s) {
            return phiCryptoService.decrypt(s);
        }
        if (value instanceof List<?> list) {
            return list.stream().map(this::decryptValue).toList();
        }
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> normalized = new HashMap<>();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                normalized.put(String.valueOf(entry.getKey()), decryptValue(entry.getValue()));
            }
            return normalized;
        }
        return value;
    }
}
