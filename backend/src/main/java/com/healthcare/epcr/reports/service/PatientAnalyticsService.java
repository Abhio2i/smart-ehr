package com.healthcare.epcr.reports.service;

import com.healthcare.epcr.organization.model.Organization;
import com.healthcare.epcr.organization.repository.OrganizationRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.epcr.epcr.model.PatientCareRecord;
import com.healthcare.epcr.epcr.repository.PatientCareRecordRepository;
import com.healthcare.epcr.patient.model.Patient;
import com.healthcare.epcr.patient.repository.PatientRepository;
import com.healthcare.epcr.reports.dto.DateCountDTO;
import com.healthcare.epcr.reports.dto.PatientRegistrationStatsDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
public class PatientAnalyticsService {

    private static final String CACHE_PREFIX = "reports:patients:summary:";
    private static final String COUNTER_PREFIX = "reports:patients:count:";
    private static final long CACHE_TTL_MINUTES = 10;

    private final PatientCareRecordRepository epcrRepository;
    private final PatientRepository patientRepository;
    private final OrganizationRepository organizationRepository;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public PatientRegistrationStatsDTO getSummary(String organizationId, String startDateStr, String endDateStr, boolean isAdmin) {
        boolean hasFilter = (organizationId != null && !organizationId.isBlank() && !"ALL".equalsIgnoreCase(organizationId))
                || (startDateStr != null && !startDateStr.isBlank())
                || (endDateStr != null && !endDateStr.isBlank());

        String cacheKey = CACHE_PREFIX + (organizationId != null && !organizationId.isBlank() ? organizationId : "ALL");

        // Only read static global cache if NO date/org filters are applied
        if (!hasFilter) {
            try {
                String cached = redisTemplate.opsForValue().get(cacheKey);
                if (cached != null && !cached.isBlank()) {
                    PatientRegistrationStatsDTO cachedDto = deserialize(cached);
                    if (cachedDto != null && cachedDto.getTotalPatients() > 0) {
                        return cachedDto;
                    }
                }
            } catch (Exception e) {
                log.warn("Redis read error for key {}: {}", cacheKey, e.getMessage());
            }
        }

        PatientRegistrationStatsDTO dto = computeSummary(organizationId, startDateStr, endDateStr, isAdmin);

        if (!hasFilter) {
            try {
                String json = serialize(dto);
                if (!json.isBlank() && dto.getTotalPatients() > 0) {
                    redisTemplate.opsForValue().set(cacheKey, json, CACHE_TTL_MINUTES, TimeUnit.MINUTES);
                }
            } catch (Exception e) {
                log.warn("Redis write error for key {}: {}", cacheKey, e.getMessage());
            }
        }

        return dto;
    }

    public PatientRegistrationStatsDTO searchSummary(String organizationId, String query, String startDateStr, String endDateStr, boolean isAdmin) {
        return computeSummary(organizationId, query, startDateStr, endDateStr, isAdmin);
    }

    private boolean matchesOrganization(String filterOrg, String recordOrgId, Map<String, String> orgNameMap) {
        if (filterOrg == null || filterOrg.isBlank() || "ALL".equalsIgnoreCase(filterOrg)) {
            return true;
        }
        if (recordOrgId == null || recordOrgId.isBlank()) {
            return false;
        }
        if (recordOrgId.equalsIgnoreCase(filterOrg)) {
            return true;
        }
        String name = orgNameMap.get(recordOrgId);
        return name != null && name.equalsIgnoreCase(filterOrg);
    }

    private PatientRegistrationStatsDTO computeSummary(String organizationId, boolean isAdmin) {
        return computeSummary(organizationId, null, null, null, isAdmin);
    }

    private PatientRegistrationStatsDTO computeSummary(String organizationId, String startDateStr, String endDateStr, boolean isAdmin) {
        return computeSummary(organizationId, null, startDateStr, endDateStr, isAdmin);
    }

    private PatientRegistrationStatsDTO computeSummary(String organizationId, String query, String startDateStr, String endDateStr, boolean isAdmin) {
        PatientRegistrationStatsDTO dto = new PatientRegistrationStatsDTO();

        LocalDate filterStart = toLocalDate(startDateStr);
        LocalDate filterEnd = toLocalDate(endDateStr);

        // 0. Build organization ID/Code -> Name lookup map
        Map<String, String> orgNameMap = new HashMap<>();
        try {
            List<Organization> orgs = organizationRepository.findAll();
            for (Organization o : orgs) {
                if (o.getId() != null && o.getName() != null) {
                    orgNameMap.put(o.getId(), o.getName());
                }
                if (o.getCode() != null && o.getName() != null) {
                    orgNameMap.put(o.getCode(), o.getName());
                }
            }
        } catch (Exception e) {
            log.warn("Could not load organization names", e);
        }

        // Key: unique effective patient key -> Value: Map of merged properties
        Map<String, Map<String, Object>> mergedPatients = new HashMap<>();

        // 1. Process ePCR records ONLY (patient_care_records)
        try {
            List<PatientCareRecord> epcrRecords = epcrRepository.findAll();
            for (PatientCareRecord rec : epcrRecords) {
                if (!matchesOrganization(organizationId, rec.getOrganizationId(), orgNameMap)) {
                    continue;
                }

                if (query != null && !query.isBlank()) {
                    String q = query.trim().toLowerCase();
                    boolean matches = (rec.getPatientName() != null && rec.getPatientName().toLowerCase().contains(q))
                            || (rec.getEmail() != null && rec.getEmail().toLowerCase().contains(q))
                            || (rec.getPatientPhone() != null && rec.getPatientPhone().toLowerCase().contains(q))
                            || (rec.getPatientId() != null && rec.getPatientId().toLowerCase().contains(q))
                            || (rec.getId() != null && rec.getId().toLowerCase().contains(q));
                    if (!matches) {
                        continue;
                    }
                }

                Object dateObj = rec.getCreatedAt();
                if (dateObj == null) dateObj = rec.getIncidentDateTime();
                if (dateObj == null) dateObj = rec.getSubmittedAt();
                if (dateObj == null) dateObj = rec.getUpdatedAt();

                LocalDate recordDate = toLocalDate(dateObj);

                if (filterStart != null && (recordDate == null || recordDate.isBefore(filterStart))) {
                    continue;
                }
                if (filterEnd != null && (recordDate == null || recordDate.isAfter(filterEnd))) {
                    continue;
                }

                String pKey = resolvePatientKey(
                        rec.getPatientId(),
                        rec.getEmail(),
                        rec.getPatientPhone(),
                        rec.getPatientName(),
                        rec.getPatientDateOfBirth(),
                        rec.getId()
                );

                Object genderObj = rec.getPatientGender() != null ? rec.getPatientGender().name() : null;
                Object ageObj = rec.getAge();
                Object orgObj = rec.getOrganizationId();

                mergePatientRecord(mergedPatients, pKey, dateObj, genderObj, ageObj, orgObj);
            }
        } catch (Exception e) {
            log.error("Error reading ePCR records repository", e);
        }

        Collection<Map<String, Object>> uniquePatients = mergedPatients.values();
        dto.setTotalPatients(uniquePatients.size());

        LocalDate today = LocalDate.now();
        LocalDate weekStart = today.minusDays(today.getDayOfWeek().getValue() - 1);
        LocalDate monthStart = today.withDayOfMonth(1);

        long todayCount = 0, weekCount = 0, monthCount = 0;
        Map<String, Long> genderMap = new HashMap<>();
        Map<String, Long> ageGroupMap = new LinkedHashMap<>();
        ageGroupMap.put("0-17", 0L);
        ageGroupMap.put("18-40", 0L);
        ageGroupMap.put("41-60", 0L);
        ageGroupMap.put("60+", 0L);
        Map<String, Long> orgMap = new HashMap<>();
        Map<String, Long> trendMap = new TreeMap<>();

        for (Map<String, Object> p : uniquePatients) {
            Object firstSeenObj = p.get("firstRegisteredAt");
            LocalDate regDate = toLocalDate(firstSeenObj);
            if (regDate != null) {
                if (regDate.isEqual(today)) todayCount++;
                if (!regDate.isBefore(weekStart)) weekCount++;
                if (!regDate.isBefore(monthStart)) monthCount++;

                String day = regDate.format(DateTimeFormatter.ISO_DATE);
                trendMap.merge(day, 1L, Long::sum);
            }

            Object genderObj = p.get("patientGender");
            String gender = genderObj != null && !genderObj.toString().isBlank()
                    ? genderObj.toString().trim().toUpperCase()
                    : "UNKNOWN";
            genderMap.merge(gender, 1L, Long::sum);

            Object ageObj = p.get("age");
            if (ageObj != null) {
                try {
                    int age = ageObj instanceof Number ? ((Number) ageObj).intValue() : Integer.parseInt(ageObj.toString().trim());
                    String bucket = age <= 17 ? "0-17" : age <= 40 ? "18-40" : age <= 60 ? "41-60" : "60+";
                    ageGroupMap.merge(bucket, 1L, Long::sum);
                } catch (Exception ignored) {}
            }

            if (isAdmin) {
                Object orgObj = p.get("organizationId");
                String rawOrg = orgObj != null && !orgObj.toString().isBlank() ? orgObj.toString().trim() : "UNASSIGNED";
                String orgName = orgNameMap.getOrDefault(rawOrg, rawOrg);
                orgMap.merge(orgName, 1L, Long::sum);
            }
        }

        dto.setNewPatientsToday(todayCount);
        dto.setNewPatientsThisWeek(weekCount);
        dto.setNewPatientsThisMonth(monthCount);
        dto.setByGender(genderMap);
        dto.setByAgeGroup(ageGroupMap);
        if (isAdmin) dto.setByOrganization(orgMap);

        List<DateCountDTO> trend = new ArrayList<>();
        trendMap.forEach((day, count) -> trend.add(new DateCountDTO(day, count)));
        dto.setTrend(trend);

        return dto;
    }

    private void mergePatientRecord(
            Map<String, Map<String, Object>> mergedPatients,
            String patientId,
            Object dateObj,
            Object genderObj,
            Object ageObj,
            Object orgObj) {

        Map<String, Object> existing = mergedPatients.get(patientId);
        if (existing == null) {
            existing = new HashMap<>();
            existing.put("firstRegisteredAt", dateObj);
            existing.put("patientGender", genderObj);
            existing.put("age", ageObj);
            existing.put("organizationId", orgObj);
            mergedPatients.put(patientId, existing);
        } else {
            LocalDate date1 = toLocalDate(existing.get("firstRegisteredAt"));
            LocalDate date2 = toLocalDate(dateObj);
            if (date2 != null && (date1 == null || date2.isBefore(date1))) {
                existing.put("firstRegisteredAt", dateObj);
            }
            if (existing.get("patientGender") == null && genderObj != null) {
                existing.put("patientGender", genderObj);
            }
            if (existing.get("age") == null && ageObj != null) {
                existing.put("age", ageObj);
            }
            if (existing.get("organizationId") == null && orgObj != null) {
                existing.put("organizationId", orgObj);
            }
        }
    }

    public long getFastCount(String organizationId) {
        String key = COUNTER_PREFIX + (organizationId != null && !organizationId.isBlank() ? organizationId : "ALL");
        try {
            String value = redisTemplate.opsForValue().get(key);
            if (value != null && !value.isBlank()) {
                long count = Long.parseLong(value);
                if (count > 0) return count;
            }
        } catch (Exception e) {
            log.warn("Redis read counter error for key {}: {}", key, e.getMessage());
        }

        PatientRegistrationStatsDTO summary = computeSummary(organizationId, false);
        long count = summary.getTotalPatients();
        try {
            redisTemplate.opsForValue().set(key, String.valueOf(count));
        } catch (Exception ignored) {}
        return count;
    }

    public void clearCache(String organizationId) {
        try {
            if (organizationId != null && !organizationId.isBlank()) {
                redisTemplate.delete(CACHE_PREFIX + organizationId);
                redisTemplate.delete(COUNTER_PREFIX + organizationId);
            }
            redisTemplate.delete(CACHE_PREFIX + "ALL");
            redisTemplate.delete(COUNTER_PREFIX + "ALL");

            Set<String> keys = redisTemplate.keys(CACHE_PREFIX + "*");
            if (keys != null && !keys.isEmpty()) {
                redisTemplate.delete(keys);
            }
            Set<String> counterKeys = redisTemplate.keys(COUNTER_PREFIX + "*");
            if (counterKeys != null && !counterKeys.isEmpty()) {
                redisTemplate.delete(counterKeys);
            }
            log.info("Evicted patient analytics Redis cache for org: {}", organizationId);
        } catch (Exception e) {
            log.error("Error clearing patient analytics cache for org: {}", organizationId, e);
        }
    }

    public void incrementCounters(String organizationId) {
        clearCache(organizationId);
    }

    public void reconcileCounters() {
        log.info("Running hourly reconciliation for patient analytics counters...");
        try {
            PatientRegistrationStatsDTO globalSummary = computeSummary(null, null, null, true);
            long total = globalSummary.getTotalPatients();
            redisTemplate.opsForValue().set(COUNTER_PREFIX + "ALL", String.valueOf(total));
            if (globalSummary.getByOrganization() != null) {
                globalSummary.getByOrganization().forEach((orgId, count) -> {
                    if (orgId != null && !"UNASSIGNED".equalsIgnoreCase(orgId)) {
                        redisTemplate.opsForValue().set(COUNTER_PREFIX + orgId, String.valueOf(count));
                    }
                });
            }
            log.info("Reconciled patient analytics total counter: {}", total);
        } catch (Exception e) {
            log.error("Error during patient analytics reconciliation job", e);
        }
    }

    private LocalDate toLocalDate(Object obj) {
        if (obj == null) return null;
        if (obj instanceof LocalDate) return (LocalDate) obj;
        if (obj instanceof Date) {
            return ((Date) obj).toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
        }
        if (obj instanceof LocalDateTime) {
            return ((LocalDateTime) obj).toLocalDate();
        }
        if (obj instanceof Instant) {
            return ((Instant) obj).atZone(ZoneId.systemDefault()).toLocalDate();
        }
        if (obj instanceof Number) {
            return Instant.ofEpochMilli(((Number) obj).longValue()).atZone(ZoneId.systemDefault()).toLocalDate();
        }
        if (obj instanceof String str) {
            str = str.trim();
            if (str.isBlank()) return null;
            try {
                if (str.contains("T")) {
                    return OffsetDateTime.parse(str).toLocalDate();
                }
                return LocalDate.parse(str);
            } catch (Exception e1) {
                try {
                    return LocalDateTime.parse(str).toLocalDate();
                } catch (Exception e2) {
                    try {
                        return Instant.parse(str).atZone(ZoneId.systemDefault()).toLocalDate();
                    } catch (Exception e3) {
                        log.warn("Unable to parse date string: {}", str);
                    }
                }
            }
        }
        return null;
    }

    private String resolvePatientKey(String patientId, String email, String phone, String name, String dob, String fallbackId) {
        if (patientId != null && !patientId.isBlank()) {
            return "PID:" + patientId.trim().toUpperCase();
        }
        if (email != null && !email.isBlank()) {
            return "EMAIL:" + email.trim().toLowerCase();
        }
        String cleanPhone = phone != null ? phone.replaceAll("[^\\d]", "") : "";
        if (cleanPhone.length() >= 7) {
            return "PHONE:" + cleanPhone;
        }
        if (name != null && !name.isBlank() && dob != null && !dob.isBlank()) {
            return "NAMEDOB:" + name.trim().toLowerCase() + "|" + dob.trim();
        }
        return "DOC:" + (fallbackId != null && !fallbackId.isBlank() ? fallbackId.trim() : UUID.randomUUID().toString());
    }

    private String serialize(PatientRegistrationStatsDTO dto) {
        try {
            return objectMapper.writeValueAsString(dto);
        } catch (Exception e) {
            log.error("Error serializing PatientRegistrationStatsDTO", e);
            return "";
        }
    }

    private PatientRegistrationStatsDTO deserialize(String json) {
        try {
            return objectMapper.readValue(json, PatientRegistrationStatsDTO.class);
        } catch (Exception e) {
            log.error("Error deserializing PatientRegistrationStatsDTO", e);
            return new PatientRegistrationStatsDTO();
        }
    }
}
