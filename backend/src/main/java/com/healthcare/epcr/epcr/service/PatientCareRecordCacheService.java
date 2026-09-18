package com.healthcare.epcr.epcr.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.healthcare.epcr.epcr.dto.PatientCareRecordDTO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Optional;

@Service
@Slf4j
public class PatientCareRecordCacheService {
    private static final String RECORD_KEY_PREFIX = "record:";

    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    public PatientCareRecordCacheService(StringRedisTemplate stringRedisTemplate) {
        this.stringRedisTemplate = stringRedisTemplate;
    }

    @Value("${epcr.record.cache.enabled:true}")
    private boolean cacheEnabled;

    @Value("${epcr.record.cache.ttl-seconds:300}")
    private long ttlSeconds;

    public Optional<PatientCareRecordDTO> getRecord(String recordId) {
        if (!isCacheable(recordId)) {
            return Optional.empty();
        }

        String key = recordKey(recordId);
        try {
            String cached = stringRedisTemplate.opsForValue().get(key);
            if (cached == null || cached.isBlank()) {
                return Optional.empty();
            }
            return Optional.of(objectMapper.readValue(cached, PatientCareRecordDTO.class));
        } catch (RedisConnectionFailureException ex) {
            log.warn("Redis unavailable while reading ePCR record cache");
            return Optional.empty();
        } catch (JsonProcessingException ex) {
            log.warn("Invalid ePCR record cache payload for key {}", key);
            evictRecord(recordId);
            return Optional.empty();
        }
    }

    public void putRecord(String recordId, PatientCareRecordDTO record) {
        if (!isCacheable(recordId) || record == null) {
            return;
        }

        String key = recordKey(recordId);
        try {
            stringRedisTemplate.opsForValue().set(
                    key,
                    objectMapper.writeValueAsString(record),
                    Duration.ofSeconds(Math.max(ttlSeconds, 1))
            );
        } catch (RedisConnectionFailureException ex) {
            log.warn("Redis unavailable while writing ePCR record cache");
        } catch (JsonProcessingException ex) {
            log.warn("Unable to serialize ePCR record for cache key {}", key);
        }
    }

    public void evictRecord(String recordId) {
        if (!isCacheable(recordId)) {
            return;
        }

        try {
            stringRedisTemplate.delete(recordKey(recordId));
        } catch (RedisConnectionFailureException ex) {
            log.warn("Redis unavailable while evicting ePCR record cache");
        }
    }

    private boolean isCacheable(String recordId) {
        return cacheEnabled && recordId != null && !recordId.isBlank();
    }

    private String recordKey(String recordId) {
        return RECORD_KEY_PREFIX + recordId;
    }
}
