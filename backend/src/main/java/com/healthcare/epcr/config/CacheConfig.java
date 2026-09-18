package com.healthcare.epcr.config;

import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.Cache;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;

import java.time.Duration;

@Configuration
@EnableCaching
public class CacheConfig implements CachingConfigurer {

    @Bean
    public RedisCacheManager redisCacheManager(
            RedisConnectionFactory connectionFactory,
            @Value("${organization.config.cache.ttl-seconds:3600}") long organizationConfigTtlSeconds,
            @Value("${reports.dashboard-metrics.cache.ttl-seconds:600}") long dashboardMetricsTtlSeconds) {
        RedisCacheConfiguration defaultConfig = RedisCacheConfiguration.defaultCacheConfig()
                .disableCachingNullValues()
                .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(
                        new GenericJackson2JsonRedisSerializer()
                                .configure(mapper -> mapper.registerModule(new JavaTimeModule()))));

        RedisCacheConfiguration organizationConfig = defaultConfig
                .entryTtl(Duration.ofSeconds(Math.max(organizationConfigTtlSeconds, 1)));
        RedisCacheConfiguration dashboardMetrics = defaultConfig
                .entryTtl(Duration.ofSeconds(Math.max(dashboardMetricsTtlSeconds, 1)));

        return RedisCacheManager.builder(connectionFactory)
                .cacheDefaults(defaultConfig)
                .withCacheConfiguration("org:config", organizationConfig)
                .withCacheConfiguration("reports:dashboardMetrics", dashboardMetrics)
                .build();
    }

    @Bean
    @Override
    public CacheErrorHandler errorHandler() {
        return new CacheErrorHandler() {
            @Override
            public void handleCacheGetError(RuntimeException exception, Cache cache, Object key) {
                // Cache is an optimization; repository reads should continue if Redis is unavailable.
            }

            @Override
            public void handleCachePutError(RuntimeException exception, Cache cache, Object key, Object value) {
                // Ignore cache write failures.
            }

            @Override
            public void handleCacheEvictError(RuntimeException exception, Cache cache, Object key) {
                // Ignore cache eviction failures.
            }

            @Override
            public void handleCacheClearError(RuntimeException exception, Cache cache) {
                // Ignore cache clear failures.
            }
        };
    }
}
