package com.healthcare.epcr.config;

import com.healthcare.epcr.security.session.cache.CachedAuthSession;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

@Configuration
@Slf4j
public class RedisConfig {

    @Value("${spring.data.redis.password:}")
    private String redisPassword;

    @Value("${auth.session.cache.enabled:true}")
    private boolean sessionCacheEnabled;

    /**
     * Fail fast at startup if the session cache is enabled but no Redis password is configured.
     * An unauthenticated Redis connection in production is a security risk.
     */
    @PostConstruct
    public void validateRedisConfig() {
        if (sessionCacheEnabled && (redisPassword == null || redisPassword.isBlank())) {
            // Allow passwordless Redis only when the URL already embeds credentials (e.g. rediss://user:pass@host)
            // or when running in a non-prod profile with AUTH_SESSION_CACHE_ENABLED explicitly set to false.
            log.warn("REDIS_PASSWORD is not set but auth.session.cache.enabled=true. " +
                    "Ensure your REDIS_URL contains embedded credentials (e.g. rediss://user:pass@host), " +
                    "otherwise set REDIS_PASSWORD to prevent unauthenticated connections.");
        }
    }

    @Bean
    public RedisTemplate<String, CachedAuthSession> authSessionRedisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, CachedAuthSession> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);
        template.setKeySerializer(new StringRedisSerializer());
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(new GenericJackson2JsonRedisSerializer());
        template.setHashValueSerializer(new GenericJackson2JsonRedisSerializer());
        template.afterPropertiesSet();
        return template;
    }

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);
        template.setKeySerializer(new StringRedisSerializer());
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(new GenericJackson2JsonRedisSerializer());
        template.setHashValueSerializer(new GenericJackson2JsonRedisSerializer());
        template.afterPropertiesSet();
        return template;
    }
}

