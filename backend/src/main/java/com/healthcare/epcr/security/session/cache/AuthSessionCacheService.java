package com.healthcare.epcr.security.session.cache;

import com.healthcare.epcr.auth.service.JwtService;
import com.healthcare.epcr.patient.repository.PatientRepository;
import com.healthcare.epcr.user.model.User;
import com.healthcare.epcr.user.model.Role;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthSessionCacheService {
    private static final String SESSION_KEY_PREFIX = "session:";

    private final RedisTemplate<String, CachedAuthSession> authSessionRedisTemplate;
    private final JwtService jwtService;
    private final PatientRepository patientRepository;

    @Value("${auth.session.cache.enabled:true}")
    private boolean cacheEnabled;

    public boolean isCacheEnabled() {
        return cacheEnabled;
    }

    public void cacheSession(User user, String accessToken) {
        cacheSession(user, accessToken, null);
    }

    public void cacheSession(User user, String accessToken, String patientId) {
        if (!cacheEnabled || user == null || user.getId() == null || accessToken == null || accessToken.isBlank()) {
            return;
        }

        Claims claims = jwtService.extractClaims(accessToken);
        Instant expiresAt = claims.getExpiration().toInstant();
        long ttlSeconds = Duration.between(Instant.now(), expiresAt).getSeconds();
        if (ttlSeconds <= 0) {
            return;
        }

        CachedAuthSession session = CachedAuthSession.builder()
                .userId(user.getId())
                .email(user.getEmail())
                .organizationId(user.getOrganizationId())
                .role(user.getRole() == null ? null : user.getRole().name())
                .patientId(patientId != null && !patientId.isBlank() ? patientId : resolvePatientId(user))
                .active(user.getActive() != null ? user.getActive() : true)
                .expiresAtEpochMillis(expiresAt.toEpochMilli())
                .build();

        try {
            authSessionRedisTemplate.opsForValue().set(sessionKey(user.getId()), session, Duration.ofSeconds(ttlSeconds));
        } catch (RedisConnectionFailureException ex) {
            // Do NOT re-throw: Redis is a cache layer. The session is already persisted
            // in MongoDB via UserSessionService.createSession(). Login must still succeed.
            log.error("Redis unavailable while caching auth session for user {} — session is in MongoDB, degraded mode active", user.getId());
        }
    }

    public Optional<CachedAuthSession> getActiveSession(String userId) {
        if (!cacheEnabled || userId == null || userId.isBlank()) {
            return Optional.empty();
        }

        try {
            CachedAuthSession session = authSessionRedisTemplate.opsForValue().get(sessionKey(userId));
            if (session == null || !Boolean.TRUE.equals(session.getActive())) {
                return Optional.empty();
            }
            if (session.getExpiresAtEpochMillis() != null
                    && session.getExpiresAtEpochMillis() <= Instant.now().toEpochMilli()) {
                invalidateSession(userId);
                return Optional.empty();
            }
            return Optional.of(session);
        } catch (RedisConnectionFailureException ex) {
            log.error("Redis unavailable while reading auth session for user {}", userId);
            return Optional.empty();
        }
    }

    public void invalidateSession(String userId) {
        if (!cacheEnabled || userId == null || userId.isBlank()) {
            return;
        }

        try {
            authSessionRedisTemplate.delete(sessionKey(userId));
        } catch (RedisConnectionFailureException ex) {
            // Do NOT re-throw: logout and token revocation must complete regardless.
            // The MongoDB session is already revoked by UserSessionService.revokeByRefreshHash().
            // Redis TTL will naturally expire the stale cache entry.
            log.error("Redis unavailable while invalidating auth session for user {} — MongoDB session still revoked", userId);
        }
    }

    private String sessionKey(String userId) {
        return SESSION_KEY_PREFIX + userId;
    }

    private String resolvePatientId(User user) {
        if (user == null || user.getRole() != Role.PATIENT || user.getEmail() == null || user.getEmail().isBlank()) {
            return null;
        }
        return patientRepository.findByEmail(user.getEmail())
                .map(patient -> patient.getPatientId() != null ? patient.getPatientId() : patient.getId())
                .orElse(null);
    }
}
