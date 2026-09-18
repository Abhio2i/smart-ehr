package com.healthcare.epcr.common.filter;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;

/**
 * Request/Response logging filter for audit trail
 * Logs all API requests with correlation IDs
 */
@Component
@Slf4j
public class RequestResponseLoggingFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                   HttpServletResponse response,
                                   FilterChain filterChain) throws ServletException, IOException {

        String correlationId = UUID.randomUUID().toString();
        long startTime = System.currentTimeMillis();

        try {
            log.info("API Request [{}] {} {} from IP: {}",
                correlationId,
                request.getMethod(),
                request.getRequestURI(),
                getClientIp(request));

            filterChain.doFilter(request, response);
        } finally {
            long duration = System.currentTimeMillis() - startTime;

            log.info("API Response [{}] - Status: {} - Duration: {}ms",
                correlationId,
                response.getStatus(),
                duration);
        }
    }

    private String getClientIp(HttpServletRequest request) {
        String clientIp = request.getHeader("X-Forwarded-For");
        if (clientIp == null || clientIp.isEmpty()) {
            clientIp = request.getRemoteAddr();
        }
        return clientIp;
    }
}

