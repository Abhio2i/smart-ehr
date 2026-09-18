package com.healthcare.epcr.patient.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class PatientOtpCacheService {
    private static final String OTP_KEY_PREFIX = "otp:";

    private final StringRedisTemplate stringRedisTemplate;

    public void storeOtp(String identifier, String hashedOtp, Duration ttl) {
        try {
            stringRedisTemplate.opsForValue().set(otpKey(identifier), hashedOtp, ttl);
        } catch (RedisConnectionFailureException ex) {
            log.error("Redis unavailable while storing OTP for identifier {}", maskForLog(identifier));
            throw ex;
        }
    }

    public Optional<String> getOtpHash(String identifier) {
        try {
            return Optional.ofNullable(stringRedisTemplate.opsForValue().get(otpKey(identifier)));
        } catch (RedisConnectionFailureException ex) {
            log.error("Redis unavailable while reading OTP for identifier {}", maskForLog(identifier));
            throw ex;
        }
    }

    public void deleteOtp(String identifier) {
        try {
            stringRedisTemplate.delete(otpKey(identifier));
        } catch (RedisConnectionFailureException ex) {
            log.error("Redis unavailable while deleting OTP for identifier {}", maskForLog(identifier));
            throw ex;
        }
    }

    private String otpKey(String identifier) {
        return OTP_KEY_PREFIX + normalizeIdentifier(identifier);
    }

    private String normalizeIdentifier(String identifier) {
        if (identifier == null) {
            return "";
        }
        String normalized = identifier.trim();
        return normalized.contains("@") ? normalized.toLowerCase() : normalized;
    }

    private String maskForLog(String identifier) {
        String normalized = normalizeIdentifier(identifier);
        if (normalized.length() <= 4) {
            return "****";
        }
        return "****" + normalized.substring(normalized.length() - 4);
    }
}
