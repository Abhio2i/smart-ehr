package com.healthcare.epcr.auth.service;

import com.healthcare.epcr.auditlog.service.AuditLogService;
import com.healthcare.epcr.auth.dto.AuthResponse;
import com.healthcare.epcr.auth.dto.CurrentUserResponse;
import com.healthcare.epcr.auth.dto.LoginResult;
import com.healthcare.epcr.auth.dto.LoginRequest;
import com.healthcare.epcr.auth.model.RefreshToken;
import com.healthcare.epcr.auth.repository.RefreshTokenRepository;
import com.healthcare.epcr.patient.repository.PatientRepository;
import com.healthcare.epcr.security.ClientIpResolver;
import com.healthcare.epcr.security.session.cache.CachedAuthSession;
import com.healthcare.epcr.security.session.cache.AuthSessionCacheService;
import com.healthcare.epcr.security.session.service.UserSessionService;
import com.healthcare.epcr.user.model.Role;
import com.healthcare.epcr.user.model.User;
import com.healthcare.epcr.user.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AuthService {
    private static final int MAX_FAILED_LOGIN_ATTEMPTS = 5;
    private static final int ACCOUNT_LOCK_MINUTES = 15;

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuditLogService auditLogService;
    private final UserSessionService userSessionService;
    private final AuthSessionCacheService authSessionCacheService;
    private final PatientRepository patientRepository;
    private final ClientIpResolver clientIpResolver;

    public LoginResult login(LoginRequest request, HttpServletRequest httpRequest) {
        if (request.getEmail() == null || request.getPassword() == null) {
            logAuthFailure(httpRequest, request != null ? request.getEmail() : null, "Email and password are required");
            throw new IllegalArgumentException("Email and password are required");
        }

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> {
                    logAuthFailure(httpRequest, request.getEmail(), "Invalid credentials");
                    return new IllegalArgumentException("Invalid credentials");
                });

        if (isAccountLocked(user)) {
            logAuthFailure(httpRequest, request.getEmail(), "Account temporarily locked due to failed attempts");
            throw new IllegalArgumentException("Account locked. Try again later");
        }

        if (user.getPasswordHash() == null || !passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            registerFailedLogin(user);
            logAuthFailure(httpRequest, request.getEmail(), "Invalid credentials");
            throw new IllegalArgumentException("Invalid credentials");
        }
        if (Boolean.FALSE.equals(user.getActive())) {
            logAuthFailure(httpRequest, request.getEmail(), "User is inactive");
            throw new IllegalArgumentException("User is inactive");
        }

        clearFailedLoginState(user);
        user.setLastLogin(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        String accessToken = jwtService.generateToken(user.getId(), user.getEmail(), user.getOrganizationId(), user.getRole().name());
        authSessionCacheService.cacheSession(user, accessToken, resolvePatientIdForUser(user));
        String refreshToken = createRefreshToken(user, resolveClientIp(httpRequest));
        String refreshHash = jwtService.hashToken(refreshToken);
        userSessionService.createSession(
                user.getId(),
                user.getOrganizationId(),
                refreshHash,
                LocalDateTime.now().plusSeconds(jwtService.getRefreshExpirationMs() / 1000)
        );

        auditLogService.logActionWithStatus(
                user.getId(),
                "LOGIN",
                "AUTH",
                user.getId(),
                "User logged in: " + user.getEmail(),
                "SUCCESS",
                resolveClientIp(httpRequest)
        );
        return LoginResult.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .authResponse(AuthResponse.builder()
                .id(user.getId())
                .userId(user.getId())
                .email(user.getEmail())
                .organizationId(user.getOrganizationId())
                .role(user.getRole())
                .token(accessToken)
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .build())
                .build();
    }

    public void logout(HttpServletRequest httpRequest) {
        String token = resolveAccessToken(httpRequest);
        String refreshTokenValue = jwtService.getRefreshTokenFromCookies(httpRequest);
        if (refreshTokenValue != null && !refreshTokenValue.isBlank()) {
            userSessionService.revokeByRefreshHash(jwtService.hashToken(refreshTokenValue), "LOGOUT");
            revokeRefreshToken(refreshTokenValue);
        }

        String userId = "SYSTEM";
        String details = "User logged out";
        if (token != null && !token.isBlank()) {
            String tokenUserId = null;
            String email = null;
            try {
                tokenUserId = jwtService.extractUserId(token);
                email = jwtService.extractUsername(token);
            } catch (io.jsonwebtoken.ExpiredJwtException e) {
                tokenUserId = e.getClaims().get("uid", String.class);
                email = e.getClaims().getSubject();
            } catch (Exception e) {
                // ignore
            }

            if (tokenUserId != null) {
                authSessionCacheService.invalidateSession(tokenUserId);
                userSessionService.revokeAllSessionsForUser(tokenUserId, "LOGOUT");
            }

            if (email != null) {
                userRepository.findByEmail(email).ifPresent(user -> {
                    auditLogService.logActionWithStatus(
                            user.getId(),
                            "LOGOUT",
                            "AUTH",
                            user.getId(),
                            "User logged out: " + user.getEmail(),
                            "SUCCESS",
                            resolveClientIp(httpRequest)
                    );
                });
                return;
            }
        }

        auditLogService.logActionWithStatus(
                userId,
                "LOGOUT",
                "AUTH",
                null,
                details,
                "SUCCESS",
                resolveClientIp(httpRequest)
        );
    }

    public LoginResult refreshSession(HttpServletRequest request) {
        String refreshTokenValue = jwtService.getRefreshTokenFromCookies(request);
        if (refreshTokenValue == null || refreshTokenValue.isBlank()) {
            throw new IllegalArgumentException("Refresh token is missing");
        }

        String incomingHash = jwtService.hashToken(refreshTokenValue);
        userSessionService.requireActiveSession(incomingHash);
        RefreshToken stored = refreshTokenRepository.findByTokenHash(incomingHash)
                .orElseThrow(() -> new IllegalArgumentException("Invalid refresh token"));

        if (stored.getRevokedAt() != null || stored.getExpiresAt() == null || stored.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("Refresh token expired or revoked");
        }

        User user = userRepository.findById(stored.getUserId())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        String nextRefreshToken = createRefreshToken(user, resolveClientIp(request));
        String nextRefreshHash = jwtService.hashToken(nextRefreshToken);
        stored.setRevokedAt(LocalDateTime.now());
        stored.setReplacedByTokenHash(nextRefreshHash);
        refreshTokenRepository.save(stored);
        userSessionService.revokeByRefreshHash(incomingHash, "REFRESH_ROTATED");
        userSessionService.createSession(
                user.getId(),
                user.getOrganizationId(),
                nextRefreshHash,
                LocalDateTime.now().plusSeconds(jwtService.getRefreshExpirationMs() / 1000)
        );

        String accessToken = jwtService.generateToken(user.getId(), user.getEmail(), user.getOrganizationId(), user.getRole().name());
        authSessionCacheService.cacheSession(user, accessToken, resolvePatientIdForUser(user));
        return LoginResult.builder()
                .accessToken(accessToken)
                .refreshToken(nextRefreshToken)
                .authResponse(AuthResponse.builder()
                        .id(user.getId())
                        .userId(user.getId())
                        .email(user.getEmail())
                        .organizationId(user.getOrganizationId())
                        .role(user.getRole())
                        .token(accessToken)
                        .accessToken(accessToken)
                        .refreshToken(nextRefreshToken)
                        .build())
                .build();
    }

    public CurrentUserResponse getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null) {
            throw new IllegalArgumentException("Authenticated user not found");
        }

        User user = null;
        Object details = authentication.getDetails();
        if (details instanceof CachedAuthSession session
                && session.getUserId() != null
                && !session.getUserId().isBlank()) {
            user = userRepository.findById(session.getUserId()).orElse(null);
        }

        if (user == null) {
            if (authentication.getName() == null || authentication.getName().isBlank()) {
                throw new IllegalArgumentException("Authenticated user not found");
            }
            user = userRepository.findByEmail(authentication.getName())
                    .orElseThrow(() -> new IllegalArgumentException("Authenticated user not found"));
        }

        return CurrentUserResponse.builder()
                .id(user.getId())
                .userId(user.getId())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .email(user.getEmail())
                .organizationId(user.getOrganizationId())
                .role(user.getRole())
                .build();
    }

    private void logAuthFailure(HttpServletRequest request, String email, String reason) {
        String details = (email == null || email.isBlank())
                ? "Login failed: " + reason
                : "Login failed for " + email + ": " + reason;
        auditLogService.logActionWithStatus(
                "SYSTEM",
                "LOGIN",
                "AUTH",
                null,
                details,
                "FAILED",
                resolveClientIp(request)
        );
    }

    private boolean isAccountLocked(User user) {
        return user.getAccountLockedUntil() != null && user.getAccountLockedUntil().isAfter(LocalDateTime.now());
    }

    private void registerFailedLogin(User user) {
        int attempts = user.getFailedLoginAttempts() == null ? 0 : user.getFailedLoginAttempts();
        attempts++;
        user.setFailedLoginAttempts(attempts);
        if (attempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
            user.setAccountLockedUntil(LocalDateTime.now().plusMinutes(ACCOUNT_LOCK_MINUTES));
            user.setFailedLoginAttempts(0);
        }
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);
    }

    private void clearFailedLoginState(User user) {
        user.setFailedLoginAttempts(0);
        user.setAccountLockedUntil(null);
    }

    private String createRefreshToken(User user, String clientIp) {
        String rawRefreshToken = jwtService.generateRefreshTokenValue();
        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setUserId(user.getId());
        refreshToken.setTokenHash(jwtService.hashToken(rawRefreshToken));
        refreshToken.setCreatedAt(LocalDateTime.now());
        refreshToken.setCreatedByIp(clientIp);
        refreshToken.setExpiresAt(LocalDateTime.now().plusSeconds(jwtService.getRefreshExpirationMs() / 1000));
        refreshTokenRepository.save(refreshToken);
        return rawRefreshToken;
    }

    private void revokeRefreshToken(String refreshTokenValue) {
        String hashed = jwtService.hashToken(refreshTokenValue);
        refreshTokenRepository.findByTokenHash(hashed).ifPresent(token -> {
            if (token.getRevokedAt() == null) {
                token.setRevokedAt(LocalDateTime.now());
                refreshTokenRepository.save(token);
            }
        });
    }

    private String resolveAccessToken(HttpServletRequest request) {
        String jwtFromCookie = jwtService.getJwtFromCookies(request);
        if (jwtFromCookie != null && !jwtFromCookie.isBlank()) {
            return jwtFromCookie;
        }
        return jwtService.getJwtFromHeader(request);
    }

    private String resolveClientIp(HttpServletRequest request) {
        return clientIpResolver.resolve(request);
    }

    private String resolvePatientIdForUser(User user) {
        if (user == null || user.getRole() != Role.PATIENT || user.getEmail() == null || user.getEmail().isBlank()) {
            return null;
        }
        return patientRepository.findByEmail(user.getEmail())
                .map(patient -> patient.getPatientId() != null ? patient.getPatientId() : patient.getId())
                .orElse(null);
    }
}
