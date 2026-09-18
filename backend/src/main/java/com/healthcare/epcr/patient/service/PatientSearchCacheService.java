package com.healthcare.epcr.patient.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.epcr.patient.dto.PatientSearchResultDTO;
import com.healthcare.epcr.security.AccessControlService;
import com.healthcare.epcr.user.model.Role;
import com.healthcare.epcr.user.model.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class PatientSearchCacheService {
    private static final String SEARCH_KEY_PREFIX = "search:";
    private static final TypeReference<List<PatientSearchResultDTO>> SEARCH_RESULTS_TYPE = new TypeReference<>() {};

    private final StringRedisTemplate stringRedisTemplate;
    private final AccessControlService accessControlService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${patient.search.cache.enabled:true}")
    private boolean cacheEnabled;

    @Value("${patient.search.cache.ttl-seconds:180}")
    private long ttlSeconds;

    public Optional<List<PatientSearchResultDTO>> getSearch(String query, int limit) {
        if (!cacheEnabled) {
            return Optional.empty();
        }

        String key = searchKey(query, limit);
        try {
            String cached = stringRedisTemplate.opsForValue().get(key);
            if (cached == null || cached.isBlank()) {
                return Optional.empty();
            }
            return Optional.of(objectMapper.readValue(cached, SEARCH_RESULTS_TYPE));
        } catch (RedisConnectionFailureException ex) {
            log.warn("Redis unavailable while reading patient search cache");
            return Optional.empty();
        } catch (JsonProcessingException ex) {
            log.warn("Invalid patient search cache payload for key {}", key);
            stringRedisTemplate.delete(key);
            return Optional.empty();
        }
    }

    public void putSearch(String query, int limit, List<PatientSearchResultDTO> results) {
        if (!cacheEnabled || results == null) {
            return;
        }

        String key = searchKey(query, limit);
        try {
            stringRedisTemplate.opsForValue().set(
                    key,
                    objectMapper.writeValueAsString(results),
                    Duration.ofSeconds(Math.max(ttlSeconds, 1))
            );
        } catch (RedisConnectionFailureException ex) {
            log.warn("Redis unavailable while writing patient search cache");
        } catch (JsonProcessingException ex) {
            log.warn("Unable to serialize patient search results for cache key {}", key);
        }
    }

    public void evictSearchCacheForOrganization(String organizationId) {
        if (!cacheEnabled) {
            return;
        }
        // Invalidate both org-scoped and admin-scoped search caches because both can surface ePCR-derived patient rows.
        evictByScope(scopeForOrganization(organizationId));
        evictByScope("admin");
    }

    private String searchKey(String query, int limit) {
        String scope = accessScope();
        return SEARCH_KEY_PREFIX
                + scope
                + ":limit:" + limit
                + ":q:" + sha256(normalizedQuery(query));
    }

    private void evictByScope(String scope) {
        if (scope == null || scope.isBlank()) {
            return;
        }
        String pattern = SEARCH_KEY_PREFIX + scope + ":*";
        try {
            var keys = stringRedisTemplate.keys(pattern);
            if (keys != null && !keys.isEmpty()) {
                stringRedisTemplate.delete(keys);
            }
        } catch (RedisConnectionFailureException ex) {
            log.warn("Redis unavailable while evicting patient search cache for scope {}", scope);
        }
    }

    private String accessScope() {
        User user = accessControlService.currentUser();
        if (user != null && user.getRole() == Role.ADMIN) {
            return "admin";
        }
        String organizationId = user == null ? null : user.getOrganizationId();
        return scopeForOrganization(organizationId);
    }

    private String scopeForOrganization(String organizationId) {
        return organizationId == null || organizationId.isBlank() ? "none" : organizationId;
    }

    private String normalizedQuery(String query) {
        return query == null ? "" : query.trim().toLowerCase();
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 algorithm unavailable", ex);
        }
    }
}
