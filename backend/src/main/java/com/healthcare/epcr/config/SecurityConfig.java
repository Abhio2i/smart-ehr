package com.healthcare.epcr.config;

import com.healthcare.epcr.security
        .JwtAuthenticationFilter;
import com.healthcare.epcr.security.JsonAccessDeniedHandler;
import com.healthcare.epcr.security.JsonAuthenticationEntryPoint;
import com.healthcare.epcr.common.filter.RateLimitingFilter;
import com.healthcare.epcr.patient.security.PatientAuthenticationFilter;
import com.healthcare.epcr.hipaa.filter.PhiLockboxFilter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.config.Customizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;

@Configuration
@EnableMethodSecurity
@RequiredArgsConstructor
@Slf4j
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final JsonAuthenticationEntryPoint authenticationEntryPoint;
    private final JsonAccessDeniedHandler accessDeniedHandler;
    private final RateLimitingFilter rateLimitingFilter;
    private final PatientAuthenticationFilter patientAuthenticationFilter;
    private final PhiLockboxFilter phiLockboxFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        var pathMatcher = PathPatternRequestMatcher.withDefaults();

        http
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf
                        .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                        // Exempt authentication endpoints so clients can obtain/refresh JWT cookie without CSRF
                        // Use PathPatternRequestMatcher (Spring Security 7 replacement for AntPathRequestMatcher)
                        .ignoringRequestMatchers(
                                pathMatcher.matcher(HttpMethod.POST, "/api/auth/login"),
                                pathMatcher.matcher(HttpMethod.POST, "/api/auth/logout"),
                                pathMatcher.matcher(HttpMethod.POST, "/api/auth/refresh"),
                                pathMatcher.matcher("/ws/**"),
                                pathMatcher.matcher(HttpMethod.POST, "/api/patient/auth/request-otp"),
                                pathMatcher.matcher(HttpMethod.POST, "/api/patient/auth/login"),
                                pathMatcher.matcher(HttpMethod.POST, "/api/patient/auth/logout"),
                                pathMatcher.matcher("/api/chat/**"),
                                pathMatcher.matcher(HttpMethod.POST, "/api/ai/suggestions/**"),
                                pathMatcher.matcher(HttpMethod.POST, "/api/ai/voice/**"),
                                pathMatcher.matcher(HttpMethod.POST, "/api/hipaa/deid/**"),
                                pathMatcher.matcher("/api/epcr/**"),
                                pathMatcher.matcher("/api/break-glass/**"),
                                        pathMatcher.matcher(HttpMethod.POST, "/api/patients/*/history/**"),
                                        pathMatcher.matcher(HttpMethod.PUT, "/api/patients/*/history/**"),
                                        pathMatcher.matcher(HttpMethod.DELETE, "/api/patients/*/history/**"),
                                        pathMatcher.matcher(HttpMethod.POST, "/api/patients/*/registration/**"),
                                        pathMatcher.matcher(HttpMethod.DELETE, "/api/patients/*/registration/**"),
                                        pathMatcher.matcher(HttpMethod.POST, "/api/patients/*/medication-orders/**"),
                                        pathMatcher.matcher(HttpMethod.PUT, "/api/patients/*/medication-orders/**"),
                                        pathMatcher.matcher(HttpMethod.DELETE, "/api/patients/*/medication-orders/**"),
                                        // Allow frontend (e.g., port 5173) to POST QA review completion without requiring CSRF token
                                        pathMatcher.matcher(HttpMethod.POST, "/api/qa/reviews/*/complete"),
                                        pathMatcher.matcher(HttpMethod.PUT, "/api/qa/reviews/*/complete"),
                                        // Allow patient-portal disclosure restrictions and operations from frontend without CSRF
                                        pathMatcher.matcher("/api/patient-portal/**"),
                                pathMatcher.matcher(HttpMethod.POST, "/api/feedback/**"),
                                pathMatcher.matcher(HttpMethod.PUT, "/api/feedback/**"),
                                pathMatcher.matcher(HttpMethod.DELETE, "/api/feedback/**"),
                                pathMatcher.matcher(HttpMethod.POST, "/api/tickets"),
                                pathMatcher.matcher(HttpMethod.PUT, "/api/tickets/**"),
                                pathMatcher.matcher(HttpMethod.POST, "/api/formengine/**"),
                                pathMatcher.matcher(HttpMethod.PUT, "/api/formengine/**"),
                                pathMatcher.matcher(HttpMethod.DELETE, "/api/formengine/**"),
                                pathMatcher.matcher("/api/logic/**"),
                                pathMatcher.matcher(HttpMethod.POST, "/api/notifications"),
                                pathMatcher.matcher(HttpMethod.PUT, "/api/notifications/**"),
                                pathMatcher.matcher(HttpMethod.DELETE, "/api/notifications/*"),
                                pathMatcher.matcher("/api/organizations/**"),
                                pathMatcher.matcher(HttpMethod.POST, "/api/users"),
                                pathMatcher.matcher(HttpMethod.POST, "/api/users/profile/signature-pin"),
                                pathMatcher.matcher(HttpMethod.PUT, "/api/users/*"),
                                pathMatcher.matcher(HttpMethod.DELETE, "/api/users/*"),
                                // Exempt bulk audit uploads from CSRF checks as they are protected by JWT Bearer tokens
                                pathMatcher.matcher(HttpMethod.POST, "/api/audit/logs/bulk"),
                                // Exempt HL7 routing configurations and manual resend actions from CSRF checks
                                pathMatcher.matcher("/api/hl7/**"),
                                // Exempt medication safety configuration endpoints from CSRF check
                                pathMatcher.matcher("/api/drug-master/**"),
                                pathMatcher.matcher("/api/drug-interactions/**"),
                                pathMatcher.matcher("/api/medications/**"),
                                // Exempt medical travel management endpoints from CSRF check
                                pathMatcher.matcher("/api/travel/**"),
                                // Exempt bed management endpoints from CSRF check
                                pathMatcher.matcher("/api/beds/**"),
                                pathMatcher.matcher(HttpMethod.POST, "/api/beds"),
                                pathMatcher.matcher(HttpMethod.DELETE, "/api/beds/**"),
                                // Exempt scheduling endpoints from CSRF check
                                pathMatcher.matcher("/api/scheduling/**"),
                                // Exempt homecare endpoints from CSRF check
                                pathMatcher.matcher("/api/homecare/**"),
                                // Exempt surgical endpoints from CSRF check
                                pathMatcher.matcher("/api/surgical/**"),
                                // Exempt billing and payment endpoints from CSRF check
                                pathMatcher.matcher("/api/billing/**"),
                                pathMatcher.matcher("/api/payments/**"),
                                // Exempt waitlist endpoints from CSRF check
                                pathMatcher.matcher("/api/waitlist/**"),
                                // Exempt TB case and contact management endpoints from CSRF check
                                pathMatcher.matcher("/api/tb/**"),
                                // Exempt retention and archiving lifecycle endpoints from CSRF check
                                pathMatcher.matcher("/api/retention/**"),
                                 // Exempt dental and ophthalmology endpoints from CSRF check (protected by JWT Bearer tokens)
                                 pathMatcher.matcher("/api/dental/**"),
                                 pathMatcher.matcher("/api/ophthalmology/**"),
                                 pathMatcher.matcher("/api/ltc/**"),
                                 pathMatcher.matcher("/api/mental-health/**"),
                                 pathMatcher.matcher("/api/cfs/**"),
                                 pathMatcher.matcher("/api/rehab/**"),
                                 // Exempt Ontario health integration endpoints (iPHIS, OLIS, Panorama) from CSRF check
                                 pathMatcher.matcher("/api/ontario/**"),
                                  // Exempt record share endpoints from CSRF check
                                  pathMatcher.matcher("/api/records/*/shares"),
                                  pathMatcher.matcher("/api/shares/**"),
                                 // Exempt lockbox management endpoints from CSRF check
                                 pathMatcher.matcher(HttpMethod.PUT, "/api/patients/*/lockbox"),
                                 pathMatcher.matcher(HttpMethod.POST, "/api/patients/*/lockbox/override-grant"),
                                 pathMatcher.matcher(HttpMethod.DELETE, "/api/patients/*/lockbox/override-grant/*"),
                                 // Razorpay webhook uses HMAC-SHA256 signature auth — no CSRF token from external server
                                 pathMatcher.matcher(HttpMethod.POST, "/api/webhooks/razorpay")
                        )
                )
                .headers(headers -> headers
                        .frameOptions(frame -> frame.deny())
                        .contentTypeOptions(contentType -> {})
                        .httpStrictTransportSecurity(hsts -> hsts.includeSubDomains(true).maxAgeInSeconds(31536000))
                        .referrerPolicy(referrer -> referrer.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.NO_REFERRER))
                )
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler)
                )
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/files/**").permitAll()
                        .requestMatchers("/ws/**").permitAll()
                        // Razorpay webhook is authenticated via HMAC-SHA256 header, not JWT
                        .requestMatchers(HttpMethod.POST, "/api/webhooks/razorpay").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/login", "/api/auth/logout", "/api/auth/refresh").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/patient/auth/request-otp", "/api/patient/auth/login", "/api/patient/auth/logout").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/epcr/incident-types").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/qa/reviews/*/complete").hasAnyRole("ADMIN", "QA_REVIEWER", "PARAMEDIC")
                        .requestMatchers(HttpMethod.PUT, "/api/qa/reviews/*/complete").hasAnyRole("ADMIN", "QA_REVIEWER", "PARAMEDIC")
                        .requestMatchers(HttpMethod.POST, "/api/notifications").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "QA_REVIEWER", "PHYSICIAN", "VIEWER")
                        .requestMatchers(HttpMethod.PUT, "/api/notifications/**").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "QA_REVIEWER", "PHYSICIAN", "VIEWER", "PATIENT")
                        .requestMatchers(HttpMethod.DELETE, "/api/notifications/*").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "QA_REVIEWER", "PHYSICIAN", "VIEWER", "PATIENT")
                        .requestMatchers(HttpMethod.POST, "/api/feedback/**").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "QA_REVIEWER", "PHYSICIAN", "VIEWER")
                        .requestMatchers(HttpMethod.PUT, "/api/feedback/**").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "QA_REVIEWER", "PHYSICIAN", "VIEWER")
                        .requestMatchers(HttpMethod.DELETE, "/api/feedback/**").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "QA_REVIEWER", "PHYSICIAN", "VIEWER")
                        .requestMatchers(HttpMethod.GET, "/api/patients/*/history").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "PHYSICIAN", "VIEWER", "PATIENT")
                        .requestMatchers(HttpMethod.GET, "/api/patients/*/history/**").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "PHYSICIAN", "VIEWER", "PATIENT")
                        .requestMatchers(HttpMethod.POST, "/api/patients/*/history").hasAnyRole("ADMIN", "PARAMEDIC", "PHYSICIAN")
                        .requestMatchers(HttpMethod.POST, "/api/patients/*/history/**").hasAnyRole("ADMIN", "PARAMEDIC", "PHYSICIAN")
                        .requestMatchers(HttpMethod.PUT, "/api/patients/*/history").hasAnyRole("ADMIN", "PARAMEDIC", "PHYSICIAN")
                        .requestMatchers(HttpMethod.PUT, "/api/patients/*/history/**").hasAnyRole("ADMIN", "PARAMEDIC", "PHYSICIAN")
                        .requestMatchers(HttpMethod.DELETE, "/api/patients/*/history").hasAnyRole("ADMIN", "PARAMEDIC", "PHYSICIAN")
                        .requestMatchers(HttpMethod.DELETE, "/api/patients/*/history/**").hasAnyRole("ADMIN", "PARAMEDIC", "PHYSICIAN")
                        .requestMatchers(HttpMethod.GET, "/api/patients/*/registration/coverage").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "PHYSICIAN", "VIEWER", "QA_REVIEWER", "PATIENT")
                        .requestMatchers(HttpMethod.GET, "/api/patients/*/registration/coverage/active").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "PHYSICIAN", "VIEWER", "QA_REVIEWER", "PATIENT")
                        .requestMatchers(HttpMethod.POST, "/api/patients/*/registration/coverage").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "PHYSICIAN")
                        .requestMatchers(HttpMethod.POST, "/api/patients/*/registration/coverage/verify").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "PHYSICIAN")
                        .requestMatchers(HttpMethod.DELETE, "/api/patients/*/registration/coverage").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "PHYSICIAN")
                        
                        .requestMatchers(HttpMethod.GET, "/api/patients/*/medication-orders").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "PHYSICIAN", "VIEWER", "QA_REVIEWER", "PATIENT")
                        .requestMatchers(HttpMethod.GET, "/api/patients/*/medication-orders/**").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "PHYSICIAN", "VIEWER", "QA_REVIEWER", "PATIENT")
                        .requestMatchers(HttpMethod.POST, "/api/patients/*/medication-orders").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "PHYSICIAN")
                        .requestMatchers(HttpMethod.POST, "/api/patients/*/medication-orders/**").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "PHYSICIAN")
                        .requestMatchers(HttpMethod.POST, "/api/epcr/records").hasAnyRole("ADMIN", "PARAMEDIC", "QA_REVIEWER", "PHYSICIAN")
                        .requestMatchers(HttpMethod.PUT, "/api/epcr/records/*").hasAnyRole("ADMIN", "PARAMEDIC", "QA_REVIEWER", "PHYSICIAN")
                        .requestMatchers(HttpMethod.DELETE, "/api/epcr/records/*").hasAnyRole("ADMIN", "PARAMEDIC")
                        .requestMatchers(HttpMethod.POST, "/api/epcr/records/*/submit").hasAnyRole("ADMIN", "PARAMEDIC", "QA_REVIEWER", "PHYSICIAN")
                        .requestMatchers(HttpMethod.POST, "/api/chat/message").permitAll()
                        .requestMatchers("/api/chat/**").authenticated()
                        // Allow authenticated patients and admins to create disclosure restrictions from patient-portal
                        // Use authenticated() to also allow patient principals created by the patient auth filter
                        .requestMatchers(HttpMethod.POST, "/api/patient-portal/disclosure-restrictions").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/admin/patients", "/api/admin/patients/**").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "PHYSICIAN", "QA_REVIEWER")
                        .requestMatchers(HttpMethod.GET, "/api/organizations/**").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "PHYSICIAN", "QA_REVIEWER")
                        .requestMatchers("/api/organizations/**").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "PHYSICIAN")
                        .requestMatchers("/api/reports/**").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "QA_REVIEWER", "PHYSICIAN")
                        .requestMatchers("/api/dashboard/**").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "QA_REVIEWER", "PHYSICIAN")
                        .requestMatchers("/api/ai/suggestions/**").hasAnyRole("ADMIN", "MANAGER", "PHYSICIAN", "PARAMEDIC", "QA_REVIEWER")
                        .requestMatchers("/api/ai/voice/**").hasAnyRole("ADMIN", "MANAGER", "PHYSICIAN", "PARAMEDIC", "QA_REVIEWER")
                        .requestMatchers("/api/qa/**").hasAnyRole("ADMIN", "MANAGER", "QA_REVIEWER", "PHYSICIAN", "PARAMEDIC")
                        .requestMatchers("/api/formengine/**").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "QA_REVIEWER", "PHYSICIAN")
                        .requestMatchers("/api/logic/**").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "QA_REVIEWER", "PHYSICIAN")
                        .requestMatchers("/api/workflows/**").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC")
                        .requestMatchers("/api/break-glass/**").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "PHYSICIAN")
                        .requestMatchers(HttpMethod.POST, "/api/hipaa/deid/**").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "PHYSICIAN")
                        .requestMatchers(HttpMethod.GET, "/api/epcr/records").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "QA_REVIEWER", "PHYSICIAN", "VIEWER")
                        .requestMatchers(HttpMethod.GET, "/api/epcr/records/*").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "QA_REVIEWER", "PHYSICIAN", "VIEWER")
                        .requestMatchers(HttpMethod.POST, "/api/hl7/records/*/resend").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "PHYSICIAN", "QA_REVIEWER")
                        .requestMatchers(HttpMethod.POST, "/api/hl7/records/*/send-observation").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "PHYSICIAN", "QA_REVIEWER")
                        .requestMatchers("/api/hl7/**").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "PHYSICIAN", "QA_REVIEWER")
                        .requestMatchers("/api/epcr/**").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "QA_REVIEWER", "PHYSICIAN")
                        .requestMatchers("/api/drug-master/**").hasAnyRole("ADMIN", "MANAGER", "PHYSICIAN", "PARAMEDIC", "QA_REVIEWER")
                        .requestMatchers("/api/drug-interactions/**").hasAnyRole("ADMIN", "MANAGER", "PHYSICIAN", "PARAMEDIC", "QA_REVIEWER")
                        .requestMatchers("/api/medications/**").hasAnyRole("ADMIN", "MANAGER", "PHYSICIAN", "PARAMEDIC", "QA_REVIEWER")
                        .requestMatchers(HttpMethod.POST, "/api/users/profile/signature-pin").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "PHYSICIAN", "QA_REVIEWER")
                        .requestMatchers(HttpMethod.GET, "/api/users", "/api/users/**").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "PHYSICIAN", "QA_REVIEWER", "VIEWER")
                        .requestMatchers("/api/users", "/api/users/**").hasAnyRole("ADMIN", "MANAGER")
                        .requestMatchers(HttpMethod.POST, "/api/records/*/shares").hasAnyRole("ADMIN", "MANAGER", "PHYSICIAN")
                        .requestMatchers("/api/records/*/shares", "/api/records/*/shares/**").hasAnyRole("ADMIN", "MANAGER", "PHYSICIAN", "PARAMEDIC", "QA_REVIEWER")
                        .requestMatchers("/api/shares/external/**").permitAll()
                        .requestMatchers("/api/shares/**").hasAnyRole("ADMIN", "MANAGER", "PHYSICIAN", "PARAMEDIC", "QA_REVIEWER")
                        .requestMatchers(HttpMethod.POST, "/api/tickets").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "QA_REVIEWER", "PHYSICIAN", "VIEWER")
                        .requestMatchers(HttpMethod.GET, "/api/patient/auth/me").authenticated()
                        .requestMatchers("/api/patient-portal/**").authenticated()
                         // ── Patient Lockbox (TPH PIM-1.1) ──────────────────────────────────────
                         .requestMatchers(HttpMethod.GET,    "/api/patients/*/lockbox").hasAnyRole("ADMIN", "MANAGER", "PHYSICIAN", "PATIENT")
                         .requestMatchers(HttpMethod.PUT,    "/api/patients/*/lockbox").hasAnyRole("ADMIN", "MANAGER", "PATIENT")
                         .requestMatchers(HttpMethod.POST,   "/api/patients/*/lockbox/override-grant").hasAnyRole("ADMIN", "MANAGER", "PATIENT")
                         .requestMatchers(HttpMethod.DELETE, "/api/patients/*/lockbox/override-grant/**").hasAnyRole("ADMIN", "MANAGER", "PATIENT")
                         .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                        .requestMatchers(
                                "/api/epcr/records/deidentified",
                                "/api/epcr/records/*/deidentified"
                        ).hasAnyRole("ADMIN", "MANAGER", "QA_REVIEWER", "VIEWER")
                        .requestMatchers("/api/feedback/**", "/api/tickets/**").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "QA_REVIEWER", "PHYSICIAN", "VIEWER")
                        .requestMatchers("/api/notifications/**").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "QA_REVIEWER", "PHYSICIAN", "VIEWER", "PATIENT")
                        .requestMatchers(HttpMethod.POST, "/api/audit/logs/bulk").hasAnyRole("ADMIN", "PARAMEDIC", "QA_REVIEWER", "PHYSICIAN", "MANAGER")
                        .requestMatchers("/api/audit/**", "/api/settings/**").hasAnyRole("ADMIN", "MANAGER")
                        // ── FHIR R4 endpoints ─────────────────────────────────────────────────
                        .requestMatchers(HttpMethod.GET, "/api/fhir/**").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "QA_REVIEWER", "PHYSICIAN", "VIEWER")
                        // ── HL7 endpoints ─────────────────────────────────────────────────
                        .requestMatchers(HttpMethod.GET, "/api/hl7/**").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "QA_REVIEWER", "PHYSICIAN", "VIEWER")
                        // ── Travel endpoints ─────────────────────────────────────────────────
                        .requestMatchers("/api/travel/**").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "PHYSICIAN", "QA_REVIEWER")
                        // ── Bed endpoints ───────────────────────────────────────────────────
                        .requestMatchers(HttpMethod.POST, "/api/beds").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC")
                        .requestMatchers(HttpMethod.DELETE, "/api/beds/**").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC")
                        .requestMatchers(HttpMethod.GET, "/api/beds", "/api/beds/**").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "PHYSICIAN", "QA_REVIEWER")
                        .requestMatchers(HttpMethod.PUT, "/api/beds/**").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "PHYSICIAN")
                        // ── Scheduling endpoints ──────────────────────────────────────────────
                        .requestMatchers(HttpMethod.POST, "/api/scheduling/templates").hasAnyRole("ADMIN", "MANAGER")
                        .requestMatchers(HttpMethod.GET, "/api/scheduling/providers").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "PHYSICIAN", "QA_REVIEWER", "PATIENT")
                        .requestMatchers(HttpMethod.GET, "/api/scheduling/slots").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "PHYSICIAN", "QA_REVIEWER", "PATIENT")
                        .requestMatchers(HttpMethod.POST, "/api/scheduling/appointments").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "PHYSICIAN")
                        .requestMatchers(HttpMethod.PUT, "/api/scheduling/appointments/**").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "PHYSICIAN")
                        .requestMatchers(HttpMethod.POST, "/api/scheduling/slots/*/book").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "PHYSICIAN", "PATIENT")
                        .requestMatchers(HttpMethod.POST, "/api/scheduling/travel-bundles").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "PHYSICIAN")
                        .requestMatchers(HttpMethod.GET, "/api/scheduling/travel-bundles/suggestions").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "PHYSICIAN")
                        .requestMatchers(HttpMethod.POST, "/api/scheduling/generate-slots").hasRole("ADMIN")
                        // ── Home Care Dispatch & Scheduling endpoints ─────────────────────────
                        .requestMatchers("/api/homecare", "/api/homecare/**").authenticated()
                        // ── Surgical Care endpoints ──────────────────────────────────────────
                        .requestMatchers("/api/surgical/**").hasAnyRole("ADMIN", "MANAGER", "PHYSICIAN", "PARAMEDIC")
                        // ── Billing endpoints ───────────────────────────────────────────────
                        .requestMatchers(HttpMethod.GET, "/api/billing/payouts/me").hasAnyRole("ADMIN", "MANAGER", "PHYSICIAN", "PARAMEDIC")
                        .requestMatchers(HttpMethod.GET, "/api/billing/payouts/rates/provider/**").hasAnyRole("ADMIN", "MANAGER", "PHYSICIAN", "PARAMEDIC")
                        .requestMatchers(HttpMethod.GET, "/api/billing/payouts/shifts/provider/**").hasAnyRole("ADMIN", "MANAGER", "PHYSICIAN", "PARAMEDIC")
                        .requestMatchers(HttpMethod.GET, "/api/billing/payouts/shifts/active").hasAnyRole("ADMIN", "MANAGER", "PHYSICIAN", "PARAMEDIC")
                        .requestMatchers(HttpMethod.POST, "/api/billing/payouts/shifts/clock-in", "/api/billing/payouts/shifts/clock-out").hasAnyRole("ADMIN", "MANAGER", "PHYSICIAN", "PARAMEDIC")
                        .requestMatchers("/api/billing/**").hasAnyRole("ADMIN", "MANAGER")
                        // ── Waitlist endpoints ──────────────────────────────────────────────
                        .requestMatchers(HttpMethod.GET, "/api/waitlist/**").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "PHYSICIAN", "PATIENT")
                        .requestMatchers("/api/waitlist/**").hasAnyRole("ADMIN", "MANAGER", "PARAMEDIC", "PHYSICIAN")
                        // ── Wildcard API rules ───────────────────────────────────────────────
                        .requestMatchers(HttpMethod.POST, "/api/**").hasAnyRole("ADMIN", "MANAGER")
                        .requestMatchers(HttpMethod.PUT, "/api/**").hasAnyRole("ADMIN", "MANAGER")
                        .requestMatchers(HttpMethod.PATCH, "/api/**").hasAnyRole("ADMIN", "MANAGER")
                        .requestMatchers(HttpMethod.DELETE, "/api/**").hasAnyRole("ADMIN", "MANAGER")
                        .anyRequest().authenticated()
                )
                .addFilterBefore(rateLimitingFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(patientAuthenticationFilter, JwtAuthenticationFilter.class)
                .addFilterAfter(phiLockboxFilter, PatientAuthenticationFilter.class);

        log.info("Security filter chain configured with rate limiting and JWT authentication");
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}
