

package com.healthcare.epcr.security;

import com.healthcare.epcr.auth.service.JwtService;
import com.healthcare.epcr.security.session.cache.AuthSessionCacheService;
import com.healthcare.epcr.security.session.cache.CachedAuthSession;
import com.healthcare.epcr.security.session.service.UserSessionService;
import com.healthcare.epcr.user.model.User;
import com.healthcare.epcr.user.model.Role;
import com.healthcare.epcr.user.repository.UserRepository;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

@Component
@Order(3)
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private static final Logger logger = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    private final JwtService jwtService;
    private final UserSessionService userSessionService;
    private final AuthSessionCacheService authSessionCacheService;
    private final UserRepository userRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        logger.debug("JwtAuthenticationFilter called for URI: {}", request.getRequestURI());
        try {
            String refreshToken = jwtService.getRefreshTokenFromCookies(request);
            if (refreshToken != null && !refreshToken.isBlank()) {
                userSessionService.touchByRefreshHash(jwtService.hashToken(refreshToken));
            }
            String jwt = parseJwt(request);
            if (jwt != null && jwtService.validateJwtToken(jwt)) {
                String userId = jwtService.extractUserId(jwt);
                String userEmail = jwtService.extractUsername(jwt);
                if (userId != null && userEmail != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                    Optional<CachedAuthSession> cachedSession = authSessionCacheService.getActiveSession(userId);
                    if (cachedSession.isEmpty()) {
                        if (userSessionService.hasActiveSession(userId)) {
                            logger.info("Redis session cache miss, but valid session found in DB for user {}. Re-hydrating Redis...", userId);
                            Claims claims = jwtService.extractClaims(jwt);
                            String orgId = claims.get("org", String.class);
                            String roleStr = claims.get("role", String.class);

                            User user = new User();
                            user.setId(userId);
                            user.setEmail(userEmail);
                            user.setOrganizationId(orgId);
                            if (roleStr != null) {
                                try {
                                    user.setRole(Role.valueOf(roleStr));
                                } catch (IllegalArgumentException e) {
                                    user.setRole(Role.VIEWER);
                                }
                            }
                            user.setActive(true);

                            authSessionCacheService.cacheSession(user, jwt);
                            cachedSession = authSessionCacheService.getActiveSession(userId);
                        }
                    }

                    if (cachedSession.isEmpty()) {
                        if (!authSessionCacheService.isCacheEnabled()) {
                                    userRepository.findById(userId)
                                    .filter(user -> Boolean.TRUE.equals(user.getActive()))
                                    .ifPresent(user -> {
                                        UserDetails userDetails = buildUserDetails(user, userEmail);
                                        CachedAuthSession sessionDetails = CachedAuthSession.builder()
                                                .userId(user.getId())
                                                .email(user.getEmail())
                                                .organizationId(user.getOrganizationId())
                                                .role(user.getRole() == null ? null : user.getRole().name())
                                                .active(Boolean.TRUE.equals(user.getActive()))
                                                .build();
                                        UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                                                userDetails,
                                                null,
                                                userDetails.getAuthorities()
                                        );
                                        authToken.setDetails(sessionDetails);
                                        SecurityContextHolder.getContext().setAuthentication(authToken);
                                    });
                            filterChain.doFilter(request, response);
                            return;
                        }
                        logger.warn("JWT rejected because Redis session is missing or inactive for user {}", userId);
                        filterChain.doFilter(request, response);
                        return;
                    }
                    UserDetails userDetails = buildUserDetails(cachedSession.get(), userEmail);
                    UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                            userDetails,
                            null,
                            userDetails.getAuthorities()
                    );
                    authToken.setDetails(cachedSession.get());
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                    logger.debug("Authenticated user: {} roles: {}", userEmail, userDetails.getAuthorities());
                }
            }
        } catch (Exception e) {
            logger.error("Cannot set user authentication: {}", e.getMessage());
        }

        filterChain.doFilter(request, response);
    }

    private UserDetails buildUserDetails(CachedAuthSession session, String tokenEmail) {
        String email = session.getEmail() == null || session.getEmail().isBlank() ? tokenEmail : session.getEmail();
        String role = session.getRole() == null || session.getRole().isBlank() ? "VIEWER" : session.getRole();
        return new org.springframework.security.core.userdetails.User(
                email,
                "",
                Boolean.TRUE.equals(session.getActive()),
                true,
                true,
                true,
                List.of(new SimpleGrantedAuthority("ROLE_" + role))
        );
    }

    private UserDetails buildUserDetails(User user, String tokenEmail) {
        String email = user.getEmail() == null || user.getEmail().isBlank() ? tokenEmail : user.getEmail();
        String role = user.getRole() == null ? "VIEWER" : user.getRole().name();
        return new org.springframework.security.core.userdetails.User(
                email,
                "",
                Boolean.TRUE.equals(user.getActive()),
                true,
                true,
                true,
                List.of(new SimpleGrantedAuthority("ROLE_" + role))
        );
    }

    private String parseJwt(HttpServletRequest request) {
        String jwtFromCookie = jwtService.getJwtFromCookies(request);
        if (isUsableToken(jwtFromCookie)) {
            return jwtFromCookie;
        }
        String jwtFromHeader = jwtService.getJwtFromHeader(request);
        return isUsableToken(jwtFromHeader) ? jwtFromHeader : null;
    }

    private boolean isUsableToken(String token) {
        return token != null
                && !token.trim().isEmpty()
                && !"null".equalsIgnoreCase(token)
                && !"undefined".equalsIgnoreCase(token);
    }
}
