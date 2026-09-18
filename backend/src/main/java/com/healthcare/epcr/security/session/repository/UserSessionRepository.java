package com.healthcare.epcr.security.session.repository;

import com.healthcare.epcr.security.session.model.UserSession;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface UserSessionRepository extends MongoRepository<UserSession, String> {
    Optional<UserSession> findByRefreshTokenHashAndActiveTrue(String refreshTokenHash);
    List<UserSession> findByUserIdAndActiveTrue(String userId);

    // Used by SessionCleanupScheduler — purge hard-expired sessions
    long deleteByExpiresAtBefore(LocalDateTime cutoff);

    // Used by SessionCleanupScheduler — purge old revoked sessions past the retention window
    long deleteByActiveFalseAndRevokedAtBefore(LocalDateTime cutoff);
}

