package com.healthcare.epcr.patient.security;

import com.healthcare.epcr.auth.service.JwtService;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
@Order(2)
@RequiredArgsConstructor
@Slf4j
public class PatientAuthenticationFilter extends OncePerRequestFilter {
    private final JwtService jwtService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        try {
            String token = resolvePatientToken(request);
            if (token == null) {
                logChatAuthDecision(request, "no patient cookie or bearer token");
            } else if (jwtService.validateJwtToken(token)
                    && SecurityContextHolder.getContext().getAuthentication() == null) {
                Claims claims = jwtService.extractClaims(token);
                if ("patient".equals(claims.get("typ", String.class))) {
                    String patientId = claims.get("pid", String.class);
                    String org = claims.get("org", String.class);
                    String subject = claims.getSubject();
                    if (patientId != null && org != null) {
                        PatientPrincipal principal = new PatientPrincipal(patientId, org, subject);
                        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                                principal,
                                null,
                                List.of(new SimpleGrantedAuthority("ROLE_PATIENT"))
                        );
                        auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                        SecurityContextHolder.getContext().setAuthentication(auth);
                        logChatAuthDecision(request, "authenticated ROLE_PATIENT");
                    }
                } else {
                    logChatAuthDecision(request, "bearer/cookie token is not a patient token");
                }
            }
        } catch (Exception ex) {
            logChatAuthDecision(request, "patient auth failed: " + ex.getClass().getSimpleName());
        }
        filterChain.doFilter(request, response);
    }

    private String resolvePatientToken(HttpServletRequest request) {
        String cookieToken = jwtService.getPatientTokenFromCookies(request);
        if (cookieToken != null && !cookieToken.isBlank()) {
            return cookieToken;
        }
        return jwtService.getJwtFromHeader(request);
    }

    private void logChatAuthDecision(HttpServletRequest request, String decision) {
        if (request.getRequestURI() != null && request.getRequestURI().startsWith("/api/chat")) {
            log.warn("Patient chat authentication: {}", decision);
        }
    }
}
