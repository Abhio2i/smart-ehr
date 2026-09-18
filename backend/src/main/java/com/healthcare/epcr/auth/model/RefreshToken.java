package com.healthcare.epcr.auth.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Document(collection = "refresh_tokens")
public class RefreshToken {
    @Id
    private String id;
    private String userId;
    @Indexed(unique = true)
    private String tokenHash;
    private LocalDateTime expiresAt;
    private LocalDateTime revokedAt;
    private String replacedByTokenHash;
    private LocalDateTime createdAt;
    private String createdByIp;
}
