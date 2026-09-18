package com.healthcare.epcr.security.session.service;

import com.healthcare.epcr.security.session.model.UserSession;
import com.healthcare.epcr.security.session.repository.UserSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class UserSessionService {
    private final UserSessionRepository repository;

    @Value("${security.session.idle-timeout-minutes:15}")
    private long idleTimeoutMinutes;

    public void createSession(String userId, String organizationId, String refreshTokenHash, LocalDateTime expiresAt) {
        UserSession session = new UserSession();
        session.setUserId(userId);
        session.setOrganizationId(organizationId);
        session.setRefreshTokenHash(refreshTokenHash);
        session.setCreatedAt(LocalDateTime.now());
        session.setLastActivityAt(LocalDateTime.now());
        session.setExpiresAt(expiresAt);
        session.setActive(true);
        repository.save(session);
    }

    public UserSession requireActiveSession(String refreshTokenHash) {
        UserSession session = repository.findByRefreshTokenHashAndActiveTrue(refreshTokenHash)
                .orElseThrow(() -> new IllegalArgumentException("Session not found or revoked"));
        if (session.getExpiresAt() != null && session.getExpiresAt().isBefore(LocalDateTime.now())) {
            revoke(session, "SESSION_EXPIRED");
            throw new IllegalArgumentException("Session expired");
        }
        if (session.getLastActivityAt() != null
                && session.getLastActivityAt().plusMinutes(idleTimeoutMinutes).isBefore(LocalDateTime.now())) {
            revoke(session, "IDLE_TIMEOUT");
            throw new IllegalArgumentException("Session expired due to inactivity");
        }
        return session;
    }

    public void touchByRefreshHash(String refreshTokenHash) {
        repository.findByRefreshTokenHashAndActiveTrue(refreshTokenHash).ifPresent(session -> {
            session.setLastActivityAt(LocalDateTime.now());
            repository.save(session);
        });
    }

    public void revokeByRefreshHash(String refreshTokenHash, String reason) {
        repository.findByRefreshTokenHashAndActiveTrue(refreshTokenHash).ifPresent(session -> revoke(session, reason));
    }

    public boolean hasActiveSession(String userId) {
        java.util.List<UserSession> sessions = repository.findByUserIdAndActiveTrue(userId);
        if (sessions.isEmpty()) {
            return false;
        }
        LocalDateTime now = LocalDateTime.now();
        boolean validFound = false;
        for (UserSession session : sessions) {
            boolean expired = session.getExpiresAt() != null && session.getExpiresAt().isBefore(now);
            boolean idleExpired = session.getLastActivityAt() != null
                    && session.getLastActivityAt().plusMinutes(idleTimeoutMinutes).isBefore(now);

            if (expired) {
                revoke(session, "SESSION_EXPIRED");
            } else if (idleExpired) {
                revoke(session, "IDLE_TIMEOUT");
            } else {
                validFound = true;
            }
        }
        return validFound;
    }

    private void revoke(UserSession session, String reason) {
        session.setActive(false);
        session.setRevokedAt(LocalDateTime.now());
        session.setRevokedReason(reason);
        repository.save(session);
    }

    public void revokeAllSessionsForUser(String userId, String reason) {
        if (userId != null && !userId.isBlank()) {
            repository.findByUserIdAndActiveTrue(userId).forEach(session -> revoke(session, reason));
        }
    }
}

