package com.healthcare.epcr.auth.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.UnsupportedJwtException;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;
import org.springframework.web.util.WebUtils;

import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.Base64;

@Service
public class JwtService {
    private static final Logger logger = LoggerFactory.getLogger(JwtService.class);
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    @Value("${auth.jwt.secret}")
    private String jwtSecret;

    @Value("${auth.jwt.expiration-ms}")
    private long jwtExpirationMs;
    @Value("${auth.refresh.expiration-ms:604800000}")
    private long refreshExpirationMs;

    @Value("${auth.jwt.cookie-name:access_token}")
    private String jwtCookieName;
    @Value("${auth.refresh.cookie-name:refresh_token}")
    private String refreshCookieName;
    @Value("${auth.patient.cookie-name:patient_access_token}")
    private String patientCookieName;
    @Value("${auth.patient.expiration-ms:900000}")
    private long patientExpirationMs;
    @Value("${auth.jwt.cookie-path:/api}")
    private String jwtCookiePath;
    @Value("${auth.jwt.cookie-http-only:true}")
    private boolean jwtCookieHttpOnly;
    @Value("${auth.jwt.cookie-secure:false}")
    private boolean jwtCookieSecure;
    @Value("${auth.jwt.cookie-same-site:Lax}")
    private String jwtCookieSameSite;

    @PostConstruct
    public void validateConfiguration() {
        try {
            byte[] decodedKey = Decoders.BASE64.decode(jwtSecret);
            if (decodedKey.length < 32) {
                throw new IllegalStateException("auth.jwt.secret must be a Base64 string with at least 32 bytes");
            }
        } catch (Exception ex) {
            throw new IllegalStateException("Invalid auth.jwt.secret. Provide a valid Base64 secret.", ex);
        }
        if (jwtExpirationMs <= 0) {
            throw new IllegalStateException("auth.jwt.expiration-ms must be greater than 0");
        }
    }

    public String generateToken(String userId, String email, String organizationId, String role) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("uid", userId);
        claims.put("org", organizationId);
        claims.put("role", role);
        return Jwts.builder()
                .claims(claims)
                .subject(email)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + jwtExpirationMs))
                .signWith(getSigningKey())
                .compact();
    }

    public String extractUsername(String token) {
        return extractAllClaims(token).getSubject();
    }

    public String extractUserId(String token) {
        return extractAllClaims(token).get("uid", String.class);
    }

    public Claims extractClaims(String token) {
        return extractAllClaims(token);
    }

    public boolean isTokenValid(String token) {
        try {
            Claims claims = extractAllClaims(token);
            return claims.getExpiration().after(new Date());
        } catch (Exception ex) {
            logger.warn("JWT validation failed: {}", ex.getMessage());
            return false;
        }
    }

    public String getJwtFromHeader(HttpServletRequest request) {
        String bearer = request.getHeader("Authorization");
        if (bearer != null && bearer.startsWith("Bearer ")) {
            return bearer.substring(7);
        }
        return null;
    }

    public String getJwtFromCookies(HttpServletRequest request) {
        Cookie cookie = WebUtils.getCookie(request, jwtCookieName);
        return cookie != null ? cookie.getValue() : null;
    }

    public String getRefreshTokenFromCookies(HttpServletRequest request) {
        Cookie cookie = WebUtils.getCookie(request, refreshCookieName);
        return cookie != null ? cookie.getValue() : null;
    }

    public String getPatientTokenFromCookies(HttpServletRequest request) {
        Cookie cookie = WebUtils.getCookie(request, patientCookieName);
        return cookie != null ? cookie.getValue() : null;
    }

    public boolean validateJwtToken(String token) {
        try {
            Jwts.parser().verifyWith(getSigningKey()).build().parseSignedClaims(token);
            return true;
        } catch (io.jsonwebtoken.security.SignatureException e) {
            logger.warn("JWT signature validation failed");
        } catch (MalformedJwtException e) {
            logger.warn("Invalid JWT token: {}", e.getMessage());
        } catch (ExpiredJwtException e) {
            logger.warn("JWT token expired: {}", e.getMessage());
        } catch (UnsupportedJwtException e) {
            logger.warn("Unsupported JWT token: {}", e.getMessage());
        } catch (IllegalArgumentException e) {
            logger.warn("JWT claims string is empty: {}", e.getMessage());
        }
        return false;
    }

    public ResponseCookie generateJwtCookie(String token) {
        return ResponseCookie.from(jwtCookieName, token)
                .path(jwtCookiePath)
                .maxAge(jwtExpirationMs / 1000)
                .httpOnly(jwtCookieHttpOnly)
                .secure(jwtCookieSecure)
                .sameSite(jwtCookieSameSite)
                .build();
    }

    public ResponseCookie getCleanJwtCookie() {
        return ResponseCookie.from(jwtCookieName, null)
                .path(jwtCookiePath)
                .maxAge(0)
                .httpOnly(jwtCookieHttpOnly)
                .secure(jwtCookieSecure)
                .sameSite(jwtCookieSameSite)
                .build();
    }

    public ResponseCookie generateRefreshCookie(String refreshToken) {
        return ResponseCookie.from(refreshCookieName, refreshToken)
                .path(jwtCookiePath)
                .maxAge(refreshExpirationMs / 1000)
                .httpOnly(jwtCookieHttpOnly)
                .secure(jwtCookieSecure)
                .sameSite(jwtCookieSameSite)
                .build();
    }

    public ResponseCookie getCleanRefreshCookie() {
        return ResponseCookie.from(refreshCookieName, null)
                .path(jwtCookiePath)
                .maxAge(0)
                .httpOnly(jwtCookieHttpOnly)
                .secure(jwtCookieSecure)
                .sameSite(jwtCookieSameSite)
                .build();
    }

    public String generatePatientToken(String patientId, String organizationId, String subject) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("pid", patientId);
        claims.put("org", organizationId);
        claims.put("typ", "patient");
        return Jwts.builder()
                .claims(claims)
                .subject(subject)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + patientExpirationMs))
                .signWith(getSigningKey())
                .compact();
    }

    public ResponseCookie generatePatientJwtCookie(String token) {
        return ResponseCookie.from(patientCookieName, token)
                .path(jwtCookiePath)
                .maxAge(patientExpirationMs / 1000)
                .httpOnly(jwtCookieHttpOnly)
                .secure(jwtCookieSecure)
                .sameSite(jwtCookieSameSite)
                .build();
    }

    public ResponseCookie getCleanPatientJwtCookie() {
        return ResponseCookie.from(patientCookieName, null)
                .path(jwtCookiePath)
                .maxAge(0)
                .httpOnly(jwtCookieHttpOnly)
                .secure(jwtCookieSecure)
                .sameSite(jwtCookieSameSite)
                .build();
    }

    public ResponseCookie getCleanPatientJwtCookieAtPath(String path) {
        return ResponseCookie.from(patientCookieName, null)
                .path(path)
                .maxAge(0)
                .httpOnly(jwtCookieHttpOnly)
                .secure(jwtCookieSecure)
                .sameSite(jwtCookieSameSite)
                .build();
    }

    public String generateRefreshTokenValue() {
        byte[] bytes = new byte[64];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hashed);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algorithm not available", e);
        }
    }

    public long getRefreshExpirationMs() {
        return refreshExpirationMs;
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    private SecretKey getSigningKey() {
        byte[] keyBytes = Decoders.BASE64.decode(jwtSecret);
        return Keys.hmacShaKeyFor(keyBytes);
    }
}
