package com.healthcare.epcr.auth.repository;

import com.healthcare.epcr.auth.model.RefreshToken;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface RefreshTokenRepository extends MongoRepository<RefreshToken, String> {
    Optional<RefreshToken> findByTokenHash(String tokenHash);
    List<RefreshToken> findByUserIdAndRevokedAtIsNull(String userId);
}
