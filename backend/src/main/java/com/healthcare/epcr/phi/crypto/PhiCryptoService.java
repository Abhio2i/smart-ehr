package com.healthcare.epcr.phi.crypto;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class PhiCryptoService {
    private static final String PREFIX = "enc::";
    private static final int GCM_TAG_BITS = 128;
    private static final int IV_LENGTH = 12;

    private final SecureRandom secureRandom = new SecureRandom();
    private final String base64Key;
    private SecretKey key;

    public PhiCryptoService(@Value("${phi.crypto.base64-key}") String base64Key) {
        this.base64Key = base64Key;
    }

    @PostConstruct
    public void init() {
        byte[] raw = Base64.getDecoder().decode(base64Key);
        if (raw.length != 32) {
            throw new IllegalStateException("phi.crypto.base64-key must decode to 32 bytes");
        }
        this.key = new SecretKeySpec(raw, "AES");
    }

    public String encrypt(String value) {
        if (value == null || value.isBlank()) {
            return value;
        }
        if (isEncrypted(value)) {
            return value;
        }
        try {
            byte[] iv = new byte[IV_LENGTH];
            secureRandom.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
            ByteBuffer buffer = ByteBuffer.allocate(iv.length + encrypted.length);
            buffer.put(iv);
            buffer.put(encrypted);
            return PREFIX + Base64.getEncoder().encodeToString(buffer.array());
        } catch (Exception e) {
            throw new IllegalStateException("Failed to encrypt PHI field", e);
        }
    }

    public String decrypt(String value) {
        if (value == null || value.isBlank()) {
            return value;
        }
        if (!isEncrypted(value)) {
            return value;
        }
        try {
            byte[] payload = Base64.getDecoder().decode(value.substring(PREFIX.length()));
            byte[] iv = new byte[IV_LENGTH];
            byte[] encrypted = new byte[payload.length - IV_LENGTH];
            System.arraycopy(payload, 0, iv, 0, IV_LENGTH);
            System.arraycopy(payload, IV_LENGTH, encrypted, 0, encrypted.length);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
            return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to decrypt PHI field", e);
        }
    }

    public List<String> encryptList(List<String> values) {
        if (values == null) {
            return null;
        }
        return values.stream().map(this::encrypt).collect(Collectors.toList());
    }

    public List<String> decryptList(List<String> values) {
        if (values == null) {
            return null;
        }
        return values.stream().map(this::decrypt).collect(Collectors.toList());
    }

    private boolean isEncrypted(String value) {
        return value != null && value.startsWith(PREFIX);
    }
}

