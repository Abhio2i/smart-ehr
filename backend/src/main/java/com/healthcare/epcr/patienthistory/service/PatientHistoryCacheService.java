package com.healthcare.epcr.patienthistory.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.healthcare.epcr.patienthistory.dto.PatientHistorySummaryDTO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Optional;

@Service
@Slf4j
public class PatientHistoryCacheService {
    private static final String PATIENT_KEY_PREFIX = "patient:";

    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    public PatientHistoryCacheService(StringRedisTemplate stringRedisTemplate) {
        this.stringRedisTemplate = stringRedisTemplate;
    }

    @Value("${patient.history.cache.enabled:true}")
    private boolean cacheEnabled;

    @Value("${patient.history.cache.ttl-seconds:900}")
    private long ttlSeconds;

    public Optional<PatientHistorySummaryDTO> getPatientHistory(String patientId) {
        if (!isCacheable(patientId)) {
            return Optional.empty();
        }

        String key = patientKey(patientId);
        try {
            String cached = stringRedisTemplate.opsForValue().get(key);
            if (cached == null || cached.isBlank()) {
                return Optional.empty();
            }
            return Optional.of(objectMapper.readValue(cached, PatientHistorySummaryDTO.class));
        } catch (RedisConnectionFailureException ex) {
            log.warn("Redis unavailable while reading patient history cache");
            return Optional.empty();
        } catch (JsonProcessingException ex) {
            log.warn("Invalid patient history cache payload for key {}", key);
            evictPatientHistory(patientId);
            return Optional.empty();
        }
    }

    public void putPatientHistory(String patientId, PatientHistorySummaryDTO summary) {
        if (!isCacheable(patientId) || summary == null) {
            return;
        }

        String key = patientKey(patientId);
        try {
            stringRedisTemplate.opsForValue().set(
                    key,
                    objectMapper.writeValueAsString(summary),
                    Duration.ofSeconds(Math.max(ttlSeconds, 1))
            );
        } catch (RedisConnectionFailureException ex) {
            log.warn("Redis unavailable while writing patient history cache");
        } catch (JsonProcessingException ex) {
            log.warn("Unable to serialize patient history for cache key {}", key);
        }
    }

    public void evictPatientHistory(String patientId) {
        if (!isCacheable(patientId)) {
            return;
        }

        try {
            stringRedisTemplate.delete(patientKey(patientId));
        } catch (RedisConnectionFailureException ex) {
            log.warn("Redis unavailable while evicting patient history cache");
        }
    }

    private boolean isCacheable(String patientId) {
        return cacheEnabled && patientId != null && !patientId.isBlank();
    }

    private String patientKey(String patientId) {
        return PATIENT_KEY_PREFIX + patientId;
    }
}
