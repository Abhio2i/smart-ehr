package com.healthcare.epcr.billing.service;

import com.healthcare.epcr.billing.model.Claim;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
@Slf4j
public class ClaimCacheService {

    private final RedisTemplate<String, Object> redisTemplate;

    @Autowired
    public ClaimCacheService(@Nullable RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    private String key(String claimId) {
        return "claim:" + claimId;
    }

    public void put(Claim claim) {
        if (redisTemplate == null || claim == null || claim.getId() == null) return;
        try {
            redisTemplate.opsForValue().set(key(claim.getId()), claim, Duration.ofMinutes(5));
        } catch (Exception ex) {
            log.warn("Failed to put claim {} in Redis cache: {}", claim.getId(), ex.getMessage());
        }
    }

    public Claim get(String claimId) {
        if (redisTemplate == null || claimId == null) return null;
        try {
            Object obj = redisTemplate.opsForValue().get(key(claimId));
            if (obj instanceof Claim claim) {
                return claim;
            }
        } catch (Exception ex) {
            log.warn("Failed to get claim {} from Redis cache: {}", claimId, ex.getMessage());
        }
        return null;
    }

    public void evict(String claimId) {
        if (redisTemplate == null || claimId == null) return;
        try {
            redisTemplate.delete(key(claimId));
        } catch (Exception ex) {
            log.warn("Failed to evict claim {} from Redis cache: {}", claimId, ex.getMessage());
        }
    }
}
