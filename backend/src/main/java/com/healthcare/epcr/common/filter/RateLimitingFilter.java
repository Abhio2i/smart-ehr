package com.healthcare.epcr.common.filter;

import com.healthcare.epcr.security.ClientIpResolver;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Bucket4j;
import io.github.bucket4j.Refill;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Rate Limiting Filter using Bucket4J
 *
 * Implements rate limiting per IP address to prevent:
 * - Brute force attacks
 * - API abuse
 * - DDoS attacks
 * - Resource exhaustion
 */
@Component
@Order(1)
@Slf4j
@RequiredArgsConstructor
public class RateLimitingFilter extends OncePerRequestFilter {

    @Value("${ratelimit.requests-per-minute:100}")
    private int requestsPerMinute;

    private final ClientIpResolver clientIpResolver;
    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                  HttpServletResponse response,
                                  FilterChain filterChain)
            throws ServletException, IOException {

        String clientIp = clientIpResolver.resolve(request);
        String key = clientIp;

        Bucket bucket = buckets.computeIfAbsent(key, k -> createBucket());

        if (bucket.tryConsume(1)) {
            // Request allowed
            response.addHeader("X-Rate-Limit-Limit", String.valueOf(requestsPerMinute));
            response.addHeader("X-Rate-Limit-Remaining", String.valueOf(bucket.getAvailableTokens()));
            filterChain.doFilter(request, response);
        } else {
            // Rate limit exceeded
            log.warn("Rate limit exceeded for IP: {}", clientIp);

            response.setStatus(429); // Too Many Requests
            response.setContentType("application/json");
            response.addHeader("X-Rate-Limit-Limit", String.valueOf(requestsPerMinute));
            response.addHeader("X-Rate-Limit-Remaining", "0");
            response.getWriter().write("{\"error\":\"Rate limit exceeded\"}");
        }
    }

    /**
     * Create a new bucket with configured limits
     */
    private Bucket createBucket() {
        Bandwidth limit = Bandwidth.classic(requestsPerMinute,
                Refill.intervally(requestsPerMinute, Duration.ofMinutes(1)));
        return Bucket4j.builder()
                .addLimit(limit)
                .build();
    }

}

