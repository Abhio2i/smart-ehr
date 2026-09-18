package com.healthcare.epcr.security.session.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Document(collection = "user_sessions")
@CompoundIndexes({
    // Fast lookup used by hasActiveSession() and findByUserIdAndActiveTrue()
    @CompoundIndex(name = "idx_userId_active", def = "{'userId': 1, 'active': 1}"),
    // Fast cleanup used by deleteByActiveFalseAndRevokedAtBefore()
    @CompoundIndex(name = "idx_active_revokedAt", def = "{'active': 1, 'revokedAt': 1}")
})
public class UserSession {
    @Id
    private String id;

    @Indexed(unique = true)
    private String refreshTokenHash;

    private String userId;
    private String organizationId;
    private LocalDateTime createdAt;
    private LocalDateTime lastActivityAt;

    // Indexed for fast deleteByExpiresAtBefore() in the cleanup scheduler
    @Indexed(name = "idx_expiresAt")
    private LocalDateTime expiresAt;

    private LocalDateTime revokedAt;
    private String revokedReason;
    private boolean active;
}

