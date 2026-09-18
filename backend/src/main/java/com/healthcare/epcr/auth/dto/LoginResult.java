package com.healthcare.epcr.auth.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class LoginResult {
    private AuthResponse authResponse;
    private String accessToken;
    private String refreshToken;
}
